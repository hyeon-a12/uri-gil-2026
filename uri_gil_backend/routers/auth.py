# 회원 API
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import User
from schemas import UserCreate, UserLogin, UserResponse
import bcrypt
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from datetime import datetime, timedelta, timezone
import os

router = APIRouter(prefix="/auth", tags=["auth"])
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "임시로컬용시크릿키-반드시Railway환경변수로교체")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7일

def create_access_token(user_id: int):
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": str(user_id), "exp": expire}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

# 회원가입
@router.post("/register", response_model=UserResponse)
def register(user: UserCreate, db: Session = Depends(get_db)):
    # 이메일 중복 확인
    existing_user = db.query(User).filter(User.email == user.email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="이미 사용 중인 이메일입니다")

    # 비밀번호 해싱
    hashed_password = bcrypt.hashpw(user.password.encode("utf-8"), bcrypt.gensalt())

    # DB에 저장
    new_user = User(
        email=user.email,
        password=hashed_password.decode("utf-8"),
        nickname=user.nickname
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

# 로그인
@router.post("/login")
def login(user: UserLogin, db: Session = Depends(get_db)):
    # 이메일로 유저 찾기
    db_user = db.query(User).filter(User.email == user.email).first()
    if not db_user:
        raise HTTPException(status_code=401, detail="이메일 또는 비밀번호가 틀렸습니다")

    # 비밀번호 확인
    if not bcrypt.checkpw(user.password.encode("utf-8"), db_user.password.encode("utf-8")):
        raise HTTPException(status_code=401, detail="이메일 또는 비밀번호가 틀렸습니다")

    token = create_access_token(db_user.id)
    return {
        "access_token": token,
        "token_type": "bearer",
        "user_id": db_user.id,
        "nickname": db_user.nickname,
    }