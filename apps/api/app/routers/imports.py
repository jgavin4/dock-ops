import io
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException, Path, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import select
import pandas as pd

from app.deps import AuthContext, get_current_auth, get_db
from app.models import Vessel, VesselInventoryRequirement, MaintenanceTask, MaintenanceCadenceType
from app.permissions import can_crud_vessels, can_edit_inventory_requirements, can_edit_maintenance_tasks
from app.schemas import VesselCreate, InventoryRequirementCreate, MaintenanceTaskCreate

router = APIRouter(prefix="/api/import", tags=["import"])


def parse_file(file: UploadFile) -> pd.DataFrame:
    """Parse CSV or Excel file into a pandas DataFrame."""
    contents = file.file.read()
    
    # Try Excel first (.xlsx, .xls)
    if file.filename.endswith(('.xlsx', '.xls')):
        try:
            df = pd.read_excel(io.BytesIO(contents))
            return df
        except Exception as e:
            raise HTTPException(
                status_code=400,
                detail=f"Failed to parse Excel file: {str(e)}"
            )
    
    # Try CSV
    elif file.filename.endswith('.csv'):
        try:
            # Try different encodings
            for encoding in ['utf-8', 'latin-1', 'iso-8859-1']:
                try:
                    df = pd.read_csv(io.BytesIO(contents), encoding=encoding)
                    return df
                except UnicodeDecodeError:
                    continue
            raise HTTPException(
                status_code=400,
                detail="Failed to parse CSV file: unsupported encoding"
            )
        except Exception as e:
            raise HTTPException(
                status_code=400,
                detail=f"Failed to parse CSV file: {str(e)}"
            )
    else:
        raise HTTPException(
            status_code=400,
            detail="Unsupported file type. Please upload a CSV or Excel file (.csv, .xlsx, .xls)"
        )


@router.post("/vessels", response_model=dict)
def import_vessels(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_current_auth),
):
    """Import vessels from CSV or Excel file.
    
    Expected columns:
    - name (required)
    - make (optional)
    - model (optional)
    - year (optional)
    - description (optional)
    - location (optional)
    """
    if not can_crud_vessels(auth):
        raise HTTPException(
            status_code=403,
            detail="Insufficient permissions to import vessels"
        )
    
    df = parse_file(file)
    
    # Normalize column names (case-insensitive, strip whitespace)
    df.columns = df.columns.str.strip().str.lower()
    
    # Check required columns
    if 'name' not in df.columns:
        raise HTTPException(
            status_code=400,
            detail="Missing required column: 'name'"
        )
    
    created = []
    errors = []
    
    for idx, row in df.iterrows():
        try:
            # Extract and validate data
            name = str(row['name']).strip()
            if not name:
                errors.append({
                    "row": idx + 2,  # +2 because idx is 0-based and header is row 1
                    "error": "Name is required"
                })
                continue
            
            vessel_data = VesselCreate(
                name=name,
                make=str(row.get('make', '')).strip() or None,
                model=str(row.get('model', '')).strip() or None,
                year=int(row['year']) if pd.notna(row.get('year')) and str(row.get('year')).strip() else None,
                description=str(row.get('description', '')).strip() or None,
                location=str(row.get('location', '')).strip() or None,
            )
            
            # Validate year if provided
            if vessel_data.year is not None:
                if vessel_data.year < 1900 or vessel_data.year > 2100:
                    errors.append({
                        "row": idx + 2,
                        "error": f"Invalid year: {vessel_data.year}"
                    })
                    continue
            
            vessel = Vessel(
                org_id=auth.org_id,
                name=vessel_data.name,
                make=vessel_data.make,
                model=vessel_data.model,
                year=vessel_data.year,
                description=vessel_data.description,
                location=vessel_data.location,
            )
            db.add(vessel)
            db.flush()  # Flush to get the ID
            
            created.append({
                "id": vessel.id,
                "name": vessel.name,
            })
        except Exception as e:
            errors.append({
                "row": idx + 2,
                "error": str(e)
            })
    
    db.commit()
    
    return {
        "success": True,
        "created_count": len(created),
        "error_count": len(errors),
        "created": created,
        "errors": errors,
    }


@router.post("/vessels/{vessel_id}/inventory-requirements", response_model=dict)
def import_inventory_requirements(
    vessel_id: int = Path(ge=1),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_current_auth),
):
    """Import inventory requirements from CSV or Excel file.
    
    Expected columns:
    - item_name (required)
    - required_quantity (required, default: 1)
    - category (optional)
    - critical (optional, default: false)
    - notes (optional)
    """
    if not can_edit_inventory_requirements(auth):
        raise HTTPException(
            status_code=403,
            detail="Insufficient permissions to import inventory requirements"
        )
    
    # Verify vessel access
    vessel = (
        db.execute(
            select(Vessel).where(
                Vessel.id == vessel_id,
                Vessel.org_id == auth.org_id
            )
        )
        .scalars()
        .one_or_none()
    )
    if not vessel:
        raise HTTPException(status_code=404, detail="Vessel not found")
    
    df = parse_file(file)
    
    # Normalize column names
    df.columns = df.columns.str.strip().str.lower()
    
    # Check required columns
    if 'item_name' not in df.columns:
        raise HTTPException(
            status_code=400,
            detail="Missing required column: 'item_name'"
        )
    
    created = []
    errors = []
    
    for idx, row in df.iterrows():
        try:
            item_name = str(row['item_name']).strip()
            if not item_name:
                errors.append({
                    "row": idx + 2,
                    "error": "Item name is required"
                })
                continue
            
            # Parse required_quantity
            required_quantity = 1
            if 'required_quantity' in df.columns and pd.notna(row.get('required_quantity')):
                try:
                    required_quantity = int(float(row['required_quantity']))
                    if required_quantity < 0:
                        raise ValueError("Required quantity must be >= 0")
                except (ValueError, TypeError):
                    errors.append({
                        "row": idx + 2,
                        "error": f"Invalid required_quantity: {row.get('required_quantity')}"
                    })
                    continue
            
            # Parse critical (accept various formats)
            critical = False
            if 'critical' in df.columns and pd.notna(row.get('critical')):
                critical_val = str(row['critical']).strip().lower()
                critical = critical_val in ('true', '1', 'yes', 'y', 'critical')
            
            requirement = VesselInventoryRequirement(
                vessel_id=vessel.id,
                item_name=item_name,
                required_quantity=required_quantity,
                category=str(row.get('category', '')).strip() or None,
                critical=critical,
                notes=str(row.get('notes', '')).strip() or None,
            )
            db.add(requirement)
            db.flush()
            
            created.append({
                "id": requirement.id,
                "item_name": requirement.item_name,
            })
        except Exception as e:
            errors.append({
                "row": idx + 2,
                "error": str(e)
            })
    
    db.commit()
    
    return {
        "success": True,
        "created_count": len(created),
        "error_count": len(errors),
        "created": created,
        "errors": errors,
    }


@router.post("/vessels/{vessel_id}/maintenance-tasks", response_model=dict)
def import_maintenance_tasks(
    vessel_id: int = Path(ge=1),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_current_auth),
):
    """Import maintenance tasks from CSV or Excel file.
    
    Expected columns:
    - name (required)
    - description (optional)
    - cadence_type (required: 'interval' or 'specific_date')
    - interval_days (required if cadence_type='interval')
    - due_date (required if cadence_type='specific_date', format: YYYY-MM-DD)
    - critical (optional, default: false)
    - is_active (optional, default: true)
    """
    if not can_edit_maintenance_tasks(auth):
        raise HTTPException(
            status_code=403,
            detail="Insufficient permissions to import maintenance tasks"
        )
    
    # Verify vessel access
    vessel = (
        db.execute(
            select(Vessel).where(
                Vessel.id == vessel_id,
                Vessel.org_id == auth.org_id
            )
        )
        .scalars()
        .one_or_none()
    )
    if not vessel:
        raise HTTPException(status_code=404, detail="Vessel not found")
    
    df = parse_file(file)
    
    # Normalize column names
    df.columns = df.columns.str.strip().str.lower()
    
    # Check required columns
    if 'name' not in df.columns:
        raise HTTPException(
            status_code=400,
            detail="Missing required column: 'name'"
        )
    if 'cadence_type' not in df.columns:
        raise HTTPException(
            status_code=400,
            detail="Missing required column: 'cadence_type'"
        )
    
    created = []
    errors = []
    
    for idx, row in df.iterrows():
        try:
            name = str(row['name']).strip()
            if not name:
                errors.append({
                    "row": idx + 2,
                    "error": "Name is required"
                })
                continue
            
            cadence_type_str = str(row['cadence_type']).strip().lower()
            if cadence_type_str not in ('interval', 'specific_date'):
                errors.append({
                    "row": idx + 2,
                    "error": f"Invalid cadence_type: {cadence_type_str}. Must be 'interval' or 'specific_date'"
                })
                continue
            
            cadence_type = MaintenanceCadenceType.INTERVAL if cadence_type_str == 'interval' else MaintenanceCadenceType.SPECIFIC_DATE
            
            # Validate cadence-specific fields
            interval_days = None
            due_date = None
            next_due_at = None
            
            if cadence_type == MaintenanceCadenceType.INTERVAL:
                if 'interval_days' not in df.columns or pd.isna(row.get('interval_days')):
                    errors.append({
                        "row": idx + 2,
                        "error": "interval_days is required for interval cadence"
                    })
                    continue
                try:
                    interval_days = int(float(row['interval_days']))
                    if interval_days < 1:
                        raise ValueError("Interval days must be >= 1")
                except (ValueError, TypeError):
                    errors.append({
                        "row": idx + 2,
                        "error": f"Invalid interval_days: {row.get('interval_days')}"
                    })
                    continue
                # Set next_due_at based on interval
                next_due_at = datetime.now(timezone.utc)
                next_due_at = next_due_at + timedelta(days=interval_days)
            else:  # SPECIFIC_DATE
                if 'due_date' not in df.columns or pd.isna(row.get('due_date')):
                    errors.append({
                        "row": idx + 2,
                        "error": "due_date is required for specific_date cadence"
                    })
                    continue
                try:
                    # Try parsing various date formats
                    due_date_str = str(row['due_date']).strip()
                    # Try pandas parsing first (handles many formats)
                    due_date = pd.to_datetime(due_date_str).to_pydatetime()
                    if due_date.tzinfo is None:
                        due_date = due_date.replace(tzinfo=timezone.utc)
                    next_due_at = due_date
                except Exception:
                    errors.append({
                        "row": idx + 2,
                        "error": f"Invalid due_date format: {row.get('due_date')}. Use YYYY-MM-DD"
                    })
                    continue
            
            # Parse critical and is_active
            critical = False
            if 'critical' in df.columns and pd.notna(row.get('critical')):
                critical_val = str(row['critical']).strip().lower()
                critical = critical_val in ('true', '1', 'yes', 'y', 'critical')
            
            is_active = True
            if 'is_active' in df.columns and pd.notna(row.get('is_active')):
                active_val = str(row['is_active']).strip().lower()
                is_active = active_val not in ('false', '0', 'no', 'n', 'inactive')
            
            task = MaintenanceTask(
                vessel_id=vessel.id,
                name=name,
                description=str(row.get('description', '')).strip() or None,
                cadence_type=cadence_type,
                interval_days=interval_days,
                due_date=due_date,
                next_due_at=next_due_at,
                critical=critical,
                is_active=is_active,
            )
            db.add(task)
            db.flush()
            
            created.append({
                "id": task.id,
                "name": task.name,
            })
        except Exception as e:
            errors.append({
                "row": idx + 2,
                "error": str(e)
            })
    
    db.commit()
    
    return {
        "success": True,
        "created_count": len(created),
        "error_count": len(errors),
        "created": created,
        "errors": errors,
    }
