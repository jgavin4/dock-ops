"""Clerk JWT verification and user management."""
import os
import json
import base64
import jwt
import httpx
from typing import Optional
from fastapi import HTTPException, Header
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.models import User, OrgMembership, MembershipStatus, OrgRole


# Clerk JWT verification
CLERK_JWKS_URL = os.getenv("CLERK_JWKS_URL", "")
CLERK_SECRET_KEY = os.getenv("CLERK_SECRET_KEY", "")

# Cache for JWKS
_jwks_cache = None


def get_clerk_jwks():
    """Fetch Clerk JWKS (JSON Web Key Set) for JWT verification."""
    global _jwks_cache
    if _jwks_cache:
        return _jwks_cache
    
    if not CLERK_JWKS_URL:
        # Development mode - skip verification if not configured
        return None
    
    try:
        response = httpx.get(CLERK_JWKS_URL, timeout=5.0)
        response.raise_for_status()
        _jwks_cache = response.json()
        return _jwks_cache
    except Exception:
        return None


def verify_clerk_token(token: str) -> Optional[dict]:
    """Verify Clerk JWT token and return payload."""
    import logging
    logger = logging.getLogger(__name__)
    
    if not CLERK_SECRET_KEY and not CLERK_JWKS_URL:
        # Development mode - allow bypass
        # In production, this should always verify
        logger.warning("No Clerk keys configured - using dev mode bypass")
        return {"sub": "dev_user_1", "email": "dev@example.com", "name": "Dev User"}
    
    try:
        # Clerk tokens use RS256 with JWKS, not HS256 with secret key
        # First, try to decode without verification to get the issuer
        unverified = jwt.decode(token, options={"verify_signature": False})
        issuer = unverified.get("iss", "")
        logger.info(f"Token issuer: {issuer}")
        
        # If we have JWKS URL, use it
        if CLERK_JWKS_URL:
            logger.info(f"Using configured JWKS URL: {CLERK_JWKS_URL}")
            jwks = get_clerk_jwks()
            if not jwks:
                raise HTTPException(status_code=401, detail="Unable to fetch JWKS")
            
            # Get kid from token header, not payload
            try:
                header_data = token.split('.')[0]
                # Add padding if needed
                header_data += '=' * (4 - len(header_data) % 4)
                header = json.loads(base64.urlsafe_b64decode(header_data))
                kid = header.get("kid")
                logger.info(f"Token header kid: {kid}")
            except Exception as e:
                logger.warning(f"Could not decode token header: {str(e)}")
                kid = None
            
            key = None
            if kid:
                for jwk in jwks.get("keys", []):
                    if jwk.get("kid") == kid:
                        key = jwt.algorithms.RSAAlgorithm.from_jwk(jwk)
                        logger.info(f"Found matching key for kid: {kid}")
                        break
            
            # If no kid or no matching key, try the first key (some tokens don't have kid)
            if not key and jwks.get("keys"):
                logger.info("No kid match found, trying first key in JWKS")
                key = jwt.algorithms.RSAAlgorithm.from_jwk(jwks.get("keys")[0])
            
            if not key:
                raise HTTPException(status_code=401, detail="Invalid token key")
            
            payload = jwt.decode(
                token,
                key,
                algorithms=["RS256"],
                options={"verify_signature": True}
            )
            return payload
        
        # If no JWKS URL but we have a Clerk instance, try to construct it
        # Clerk JWKS URLs follow pattern: https://<instance>.clerk.accounts.dev/.well-known/jwks.json
        if issuer and "clerk.accounts.dev" in issuer:
            # Extract instance from issuer (e.g., "https://valid-starfish-96.clerk.accounts.dev")
            jwks_url = f"{issuer}/.well-known/jwks.json"
            logger.info(f"Auto-detecting JWKS URL: {jwks_url}")
            global _jwks_cache
            _jwks_cache = None  # Clear cache to fetch new URL
            try:
                response = httpx.get(jwks_url, timeout=5.0)
                response.raise_for_status()
                jwks = response.json()
                _jwks_cache = jwks
                logger.info(f"Successfully fetched JWKS with {len(jwks.get('keys', []))} keys")
                
                # Get kid from token header, not payload
                import base64
                try:
                    header_data = token.split('.')[0]
                    # Add padding if needed
                    header_data += '=' * (4 - len(header_data) % 4)
                    header = json.loads(base64.urlsafe_b64decode(header_data))
                    kid = header.get("kid")
                    logger.info(f"Token header kid: {kid}")
                except Exception as e:
                    logger.warning(f"Could not decode token header: {str(e)}")
                    kid = None
                
                key = None
                if kid:
                    for jwk in jwks.get("keys", []):
                        if jwk.get("kid") == kid:
                            key = jwt.algorithms.RSAAlgorithm.from_jwk(jwk)
                            logger.info(f"Found matching key for kid: {kid}")
                            break
                
                # If no kid or no matching key, try the first key (some tokens don't have kid)
                if not key and jwks.get("keys"):
                    logger.info("No kid match found, trying first key in JWKS")
                    key = jwt.algorithms.RSAAlgorithm.from_jwk(jwks.get("keys")[0])
                
                if not key:
                    logger.error(f"Key ID {kid} not found in JWKS and no fallback key available")
                    raise HTTPException(status_code=401, detail="Invalid token key")
                
                payload = jwt.decode(
                    token,
                    key,
                    algorithms=["RS256"],
                    options={"verify_signature": True}
                )
                logger.info("Token verified successfully")
                return payload
            except httpx.HTTPError as e:
                logger.error(f"Failed to fetch JWKS: {str(e)}")
                raise HTTPException(status_code=401, detail=f"Failed to fetch JWKS: {str(e)}")
            except Exception as e:
                logger.error(f"JWKS verification error: {str(e)}")
                raise HTTPException(status_code=401, detail=f"Failed to verify token: {str(e)}")
        
        # Fallback: if we have secret key but no JWKS, skip verification in dev mode
        if CLERK_SECRET_KEY:
            logger.warning("No JWKS URL found, skipping signature verification (DEV MODE ONLY)")
            # In development, allow unverified tokens if we can't get JWKS
            # This is NOT secure for production!
            payload = jwt.decode(token, options={"verify_signature": False})
            return payload
        
        logger.error("Unable to verify token - no JWKS URL or secret key")
        raise HTTPException(status_code=401, detail="Unable to verify token - no JWKS URL or secret key")
    except jwt.ExpiredSignatureError:
        logger.warning("Token expired")
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError as e:
        logger.error(f"Invalid token: {str(e)}")
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}")
        raise HTTPException(status_code=401, detail=f"Token verification failed: {str(e)}")


def get_or_create_user(
    db: Session,
    auth_subject: str,
    email: str,
    name: Optional[str] = None,
    auth_provider: str = "clerk"
) -> User:
    """Get existing user or create new one from auth provider."""
    user = (
        db.execute(
            select(User).where(
                User.auth_provider == auth_provider,
                User.auth_subject == auth_subject
            )
        )
        .scalars()
        .one_or_none()
    )
    
    if user:
        # Update email/name if changed
        if user.email != email:
            user.email = email
        if name and user.name != name:
            user.name = name
        db.commit()
        db.refresh(user)
        return user
    
    # Create new user
    user = User(
        auth_provider=auth_provider,
        auth_subject=auth_subject,
        email=email,
        name=name
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def get_user_from_token(
    db: Session,
    authorization: Optional[str] = Header(None)
) -> User:
    """Extract user from Authorization header JWT token."""
    import logging
    logger = logging.getLogger(__name__)
    
    if not authorization:
        logger.warning("Missing authorization header")
        raise HTTPException(status_code=401, detail="Missing authorization header")
    
    if not authorization.startswith("Bearer "):
        logger.warning(f"Invalid authorization header format: {authorization[:20]}...")
        raise HTTPException(status_code=401, detail="Invalid authorization header format")
    
    token = authorization.replace("Bearer ", "")
    
    try:
        payload = verify_clerk_token(token)
    except HTTPException as e:
        logger.error(f"Token verification failed: {e.detail}")
        raise
    except Exception as e:
        logger.error(f"Unexpected error during token verification: {str(e)}")
        raise HTTPException(status_code=401, detail=f"Token verification error: {str(e)}")
    
    if not payload:
        logger.warning("Token verification returned None")
        raise HTTPException(status_code=401, detail="Invalid token")
    
    auth_subject = payload.get("sub")
    
    # Extract email - Clerk tokens can have email in different places
    email = (
        payload.get("email") or 
        payload.get("primary_email_address") or
        (payload.get("email_addresses", [{}])[0].get("email_address") if payload.get("email_addresses") else "") or
        (payload.get("email_addresses", [{}])[0].get("email") if payload.get("email_addresses") else "") or
        ""
    )
    
    # Extract name
    name = (
        payload.get("name") or 
        payload.get("first_name") or
        f"{payload.get('first_name', '')} {payload.get('last_name', '')}".strip() or
        None
    )
    
    logger.info(f"Token payload keys: {list(payload.keys())}")
    logger.info(f"Extracted - sub: {auth_subject}, email: {email}, name: {name}")
    
    if not auth_subject:
        logger.warning(f"Token missing subject. Payload keys: {list(payload.keys())}")
        raise HTTPException(status_code=401, detail="Token missing subject")
    
    if not email:
        logger.warning(f"Token missing email. Payload: {payload}")
        # Don't fail - we can create user without email and update it later
    
    logger.info(f"Successfully authenticated user: {email or 'no email'} (sub: {auth_subject})")
    return get_or_create_user(db, auth_subject, email or f"user_{auth_subject}@clerk.local", name)
