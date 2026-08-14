# 여정 내 장소 API

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import RouteSpot, Route, User
from schemas import RouteSpotCreate, RouteSpotResponse
from routers.auth import get_current_user
from typing import List

router = APIRouter(prefix="/spots", tags=["spots"])

def get_owned_route(route_id: int, db: Session, current_user: User) -> Route:
    """route_id로 route를 찾고, 현재 로그인한 유저의 소유인지 확인. 아니면 에러를 던짐."""
    route = db.query(Route).filter(Route.id == route_id).first()
    if not route:
        raise HTTPException(status_code=404, detail="여정을 찾을 수 없습니다")
    if route.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="본인의 여정에만 접근할 수 있습니다")
    return route

# 여정에 장소 추가
@router.post("/", response_model=RouteSpotResponse)
def create_spot(
    spot: RouteSpotCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # spot.route_id가 진짜 내 여정인지 먼저 확인
    get_owned_route(spot.route_id, db, current_user)

    new_spot = RouteSpot(
        route_id=spot.route_id,
        spot_name=spot.spot_name,
        latitude=spot.latitude,
        longitude=spot.longitude,
        visit_order=spot.visit_order,
        visited_at=spot.visited_at,
    )
    db.add(new_spot)
    db.commit()
    db.refresh(new_spot)
    return new_spot

# 특정 여정의 장소 목록 조회
@router.get("/route/{route_id}", response_model=List[RouteSpotResponse])
def get_spots(
    route_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    get_owned_route(route_id, db, current_user)
    spots = (
        db.query(RouteSpot)
        .filter(RouteSpot.route_id == route_id)
        .order_by(RouteSpot.visit_order)
        .all()
    )
    return spots  # 장소가 0개여도 에러 아님, 빈 배열 반환

# 방문 시간 업데이트
@router.put("/{spot_id}/visit")
def update_visited_at(
    spot_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from datetime import datetime, timezone

    spot = db.query(RouteSpot).filter(RouteSpot.id == spot_id).first()
    if not spot:
        raise HTTPException(status_code=404, detail="장소를 찾을 수 없습니다")

    # 이 장소가 속한 여정이 내 것인지 확인
    get_owned_route(spot.route_id, db, current_user)

    spot.visited_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(spot)
    return {"message": "방문 시간이 기록됐습니다", "visited_at": spot.visited_at}

# 장소 삭제
@router.delete("/{spot_id}")
def delete_spot(
    spot_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    spot = db.query(RouteSpot).filter(RouteSpot.id == spot_id).first()
    if not spot:
        raise HTTPException(status_code=404, detail="장소를 찾을 수 없습니다")

    get_owned_route(spot.route_id, db, current_user)

    db.delete(spot)
    db.commit()
    return {"message": "장소가 삭제됐습니다"}