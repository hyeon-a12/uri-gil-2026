# 여정 내 장소 API

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import RouteSpot
from schemas import RouteSpotCreate, RouteSpotResponse
from typing import List

router = APIRouter(prefix="/spots", tags=["spots"])

# 여정에 장소 추가
@router.post("/", response_model=RouteSpotResponse)
def create_spot(spot: RouteSpotCreate, db: Session = Depends(get_db)):
    new_spot = RouteSpot(
        route_id=spot.route_id,
        spot_name=spot.spot_name,
        latitude=spot.latitude,
        longitude=spot.longitude,
        visit_order=spot.visit_order,
        visited_at=spot.visited_at
    )
    db.add(new_spot)
    db.commit()
    db.refresh(new_spot)
    return new_spot

# 특정 여정의 장소 목록 조회
@router.get("/route/{route_id}", response_model=List[RouteSpotResponse])
def get_spots(route_id: int, db: Session = Depends(get_db)):
    spots = db.query(RouteSpot).filter(RouteSpot.route_id == route_id).order_by(RouteSpot.visit_order).all()
    if not spots:
        raise HTTPException(status_code=404, detail="장소가 없습니다")
    return spots

# 방문 시간 업데이트
@router.put("/{spot_id}/visit")
def update_visited_at(spot_id: int, db: Session = Depends(get_db)):
    from datetime import datetime, timezone
    spot = db.query(RouteSpot).filter(RouteSpot.id == spot_id).first()
    if not spot:
        raise HTTPException(status_code=404, detail="장소를 찾을 수 없습니다")
    spot.visited_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(spot)
    return {"message": "방문 시간이 기록됐습니다", "visited_at": spot.visited_at}

# 장소 삭제
@router.delete("/{spot_id}")
def delete_spot(spot_id: int, db: Session = Depends(get_db)):
    spot = db.query(RouteSpot).filter(RouteSpot.id == spot_id).first()
    if not spot:
        raise HTTPException(status_code=404, detail="장소를 찾을 수 없습니다")
    db.delete(spot)
    db.commit()
    return {"message": "장소가 삭제됐습니다"}