import math
import time
from fastapi import Request, HTTPException, status, Depends
from fastapi.responses import Response
from app.auth.deps import get_current_user
from app.models.user import User

R_EARTH = 6371.0
GM = 398600.0

def calculate_hohmann_delta_v(seed: int) -> float:
    """
    Calculate the total delta-v required for a Hohmann transfer.
    Deterministic based on seed.
    """
    h1 = (seed % 1000) + 300
    h2 = ((seed * 7) % 5000) + 1000
    
    r1 = R_EARTH + h1
    r2 = R_EARTH + h2
    
    v1 = math.sqrt(GM / r1)
    v2 = math.sqrt(GM / r2)
    
    a = (r1 + r2) / 2.0
    
    v_transfer1 = math.sqrt(GM * (2.0 / r1 - 1.0 / a))
    v_transfer2 = math.sqrt(GM * (2.0 / r2 - 1.0 / a))
    
    delta_v1 = abs(v_transfer1 - v1)
    delta_v2 = abs(v2 - v_transfer2)
    
    total_delta_v = delta_v1 + delta_v2
    return round(total_delta_v, 4)

async def require_m2m_proof(request: Request, current_user: User = Depends(get_current_user)) -> User:
    """
    Dependency that enforces the Machine-to-Machine Hohmann Transfer proof.
    """
    # Use current time divided by 10 as seed (10 seconds validity window)
    current_seed = int(time.time() / 10)
    
    proof_header = request.headers.get("X-Lunel-Proof")
    
    if not proof_header:
        # Challenge failed, send 401 with the challenge seed
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="M2M Challenge Required",
            headers={"X-Lunel-Challenge": str(current_seed)}
        )
        
    try:
        client_proof = float(proof_header)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Proof Format",
            headers={"X-Lunel-Challenge": str(current_seed)}
        )
        
    # Check current seed and previous seed (to allow for slight time drift)
    valid_proof_1 = calculate_hohmann_delta_v(current_seed)
    valid_proof_2 = calculate_hohmann_delta_v(current_seed - 1)
    
    if math.isclose(client_proof, valid_proof_1, rel_tol=1e-4) or math.isclose(client_proof, valid_proof_2, rel_tol=1e-4):
        return current_user
        
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="M2M Challenge Failed",
        headers={"X-Lunel-Challenge": str(current_seed)}
    )
