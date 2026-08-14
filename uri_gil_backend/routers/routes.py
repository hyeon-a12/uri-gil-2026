# 여정 API - 여정 생성/내 여정 목록 조회/특정 여정 상세 조회/여정 삭제

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import Route, User
from schemas import RouteCreate, RouteResponse
from routers.auth import get_current_user
from typing import List

router = APIRouter(prefix="/routes", tags=["routes"])

# 여정 생성
@router.post("/", response_model=RouteResponse)
def create_route(
    route: RouteCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    new_route = Route(
        user_id=current_user.id,
        title=route.title,
        region=route.region,
        theme=route.theme,
        description=route.description,
    )
    db.add(new_route)
    db.commit()
    db.refresh(new_route)
    return new_route

# 내 여정 목록 조회 (로그인한 사람 = current_user, 자기 것만 조회)
@router.get("/user/{user_id}", response_model=List[RouteResponse])
def get_user_routes(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if user_id != current_user.id:
        raise HTTPException(status_code=403, detail="본인의 여정만 조회할 수 있습니다")
    routes = db.query(Route).filter(Route.user_id == user_id).all()
    return routes  # 여정이 0개여도 그냥 빈 배열 반환 (에러 아님)

# 특정 여정 상세 조회
@router.get("/{route_id}", response_model=RouteResponse)
def get_route(
    route_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    route = db.query(Route).filter(Route.id == route_id).first()
    if not route:
        raise HTTPException(status_code=404, detail="여정을 찾을 수 없습니다")
    if route.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="본인의 여정만 조회할 수 있습니다")
    return route

# 여정 삭제
@router.delete("/{route_id}")
def delete_route(
    route_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    route = db.query(Route).filter(Route.id == route_id).first()
    if not route:
        raise HTTPException(status_code=404, detail="여정을 찾을 수 없습니다")
    if route.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="본인의 여정만 삭제할 수 있습니다")
    db.delete(route)
    db.commit()
    return {"message": "여정이 삭제됐습니다"}