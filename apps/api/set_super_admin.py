"""Set a user as super admin by email."""
import os
import sys

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models import User

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL is not set")

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def set_super_admin(email: str = None, user_id: int = None):
    """Set a user as super admin by email or user ID."""
    db = SessionLocal()
    try:
        if user_id:
            user = db.query(User).filter(User.id == user_id).first()
        elif email:
            user = db.query(User).filter(User.email == email).first()
        else:
            print("Please provide either email or user ID")
            return
        
        if not user:
            print(f"User not found.")
            print("\nAvailable users:")
            users = db.query(User).all()
            for u in users:
                email_display = u.email if u.email else "(no email)"
                print(f"  - ID: {u.id}, Email: {email_display}, Auth Subject: {u.auth_subject}, Super Admin: {u.is_super_admin}")
            return
        
        if user.is_super_admin:
            email_display = user.email if user.email else f"(ID: {user.id})"
            print(f"User {email_display} is already a super admin.")
            return
        
        user.is_super_admin = True
        db.commit()
        email_display = user.email if user.email else f"ID {user.id}"
        print(f"✓ Successfully set {email_display} (ID: {user.id}) as super admin!")
    except Exception as e:
        db.rollback()
        print(f"Error: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python set_super_admin.py <email> OR python set_super_admin.py --id <user_id>")
        print("\nExamples:")
        print("  python set_super_admin.py user@example.com")
        print("  python set_super_admin.py --id 3")
        print("\nAvailable users:")
        db = SessionLocal()
        try:
            users = db.query(User).all()
            for u in users:
                email_display = u.email if u.email else "(no email)"
                print(f"  - ID: {u.id}, Email: {email_display}, Auth Subject: {u.auth_subject}, Super Admin: {u.is_super_admin}")
        finally:
            db.close()
        sys.exit(1)
    
    if sys.argv[1] == "--id" and len(sys.argv) >= 3:
        user_id = int(sys.argv[2])
        set_super_admin(user_id=user_id)
    else:
        email = sys.argv[1]
        set_super_admin(email=email)
