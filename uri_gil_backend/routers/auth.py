# 회원 API
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from database import get_db
from models import User, Route, RouteSpot, Clip, Video
from schemas import UserCreate, UserLogin, UserResponse
import bcrypt
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from jose import jwt, JWTError
from datetime import datetime, timedelta, timezone
import os
import secrets
import resend
from models import User, Route, RouteSpot, Clip, Video, PasswordResetToken
from schemas import UserCreate, UserLogin, UserResponse, ForgotPasswordRequest, ResetPasswordRequest

resend.api_key = os.getenv("RESEND_API_KEY", "")
RESET_PAGE_URL = "https://hyeon-a12.github.io/urigil-reset-password/"
TOKEN_EXPIRY_MINUTES = 30

router = APIRouter(prefix="/auth", tags=["auth"])
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "임시로컬용시크릿키-반드시Railway환경변수로교체")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7일

security = HTTPBearer()

def create_access_token(user_id: int):
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": str(user_id), "exp": expire}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

# 회원가입
@router.post("/register", response_model=UserResponse)
def register(user: UserCreate, db: Session = Depends(get_db)):
    existing_user = db.query(User).filter(User.email == user.email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="이미 사용 중인 이메일입니다")

    hashed_password = bcrypt.hashpw(user.password.encode("utf-8"), bcrypt.gensalt())

    new_user = User(
        email=user.email,
        password=hashed_password.decode("utf-8"),
        nickname=user.nickname,
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

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security), db: Session = Depends(get_db)) -> User:
    token = credentials.credentials
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="인증 정보가 유효하지 않습니다",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = db.query(User).filter(User.id == int(user_id)).first()
    if user is None:
        raise credentials_exception
    return user

@router.get("/me")
def read_current_user(current_user: User = Depends(get_current_user)):
    return {"id": current_user.id, "email": current_user.email, "nickname": current_user.nickname}


@router.delete("/me")
def delete_account(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # 연관된 데이터부터 순서대로 삭제 (FK 제약 때문에 순서 중요)
    user_routes = db.query(Route).filter(Route.user_id == current_user.id).all()
    route_ids = [r.id for r in user_routes]

    if route_ids:
        db.query(Video).filter(Video.route_id.in_(route_ids)).delete(synchronize_session=False)
        db.query(Clip).filter(Clip.route_id.in_(route_ids)).delete(synchronize_session=False)
        db.query(RouteSpot).filter(RouteSpot.route_id.in_(route_ids)).delete(synchronize_session=False)
        db.query(Route).filter(Route.id.in_(route_ids)).delete(synchronize_session=False)

    db.delete(current_user)
    db.commit()
    return {"message": "계정이 삭제되었습니다"}

# 비밀번호 재설정 이메일 발송
@router.post("/forgot-password")
def forgot_password(payload: ForgotPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()

    # 계정 존재 여부를 노출하지 않기 위해 없어도 항상 200 응답
    if not user:
        return {"message": "이메일이 발송되었습니다."}

    # 기존에 발급된(안 쓴) 토큰은 무효화
    db.query(PasswordResetToken).filter(
        PasswordResetToken.user_id == user.id,
        PasswordResetToken.used == False,
    ).update({"used": True})

    token = secrets.token_hex(32)
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=TOKEN_EXPIRY_MINUTES)

    reset_token = PasswordResetToken(
        user_id=user.id,
        token=token,
        expires_at=expires_at,
        used=False,
    )
    db.add(reset_token)
    db.commit()

    reset_link = f"{RESET_PAGE_URL}?token={token}"

    try:
        resend.Emails.send({
            "from": "우리길 <noreply@urigil.com>",
            "to": [payload.email],
            "subject": "[우리길] 비밀번호 재설정 안내",
            "html": f"""
                <div style="font-family: 'Pretendard', sans-serif; padding: 32px; max-width: 480px; margin: 0 auto;">
                  <h2 style="color: #FF7F5C; margin-bottom: 8px;">비밀번호 재설정</h2>
                  <p style="color: #222222; font-size: 15px; line-height: 1.6;">
                    아래 버튼을 눌러 비밀번호를 재설정해주세요.<br/>
                    이 링크는 <strong>{TOKEN_EXPIRY_MINUTES}분간</strong> 유효합니다.
                  </p>
                  <a href="{reset_link}"
                     style="display:inline-block; background:#FF7F5C; color:#fff; padding:14px 28px;
                            border-radius:12px; text-decoration:none; font-weight:700; margin-top:16px;">
                    비밀번호 재설정하기
                  </a>
                  <p style="color: #8A8A8A; font-size: 12px; margin-top: 24px;">
                    본인이 요청하지 않았다면 이 이메일을 무시해주세요.
                  </p>
                </div>
            """,
        })
    except Exception as e:
        print(f"[forgot_password] 이메일 발송 실패: {e}")
        raise HTTPException(status_code=500, detail="이메일 발송에 실패했습니다")

    return {"message": "이메일이 발송되었습니다."}


# 비밀번호 재설정 (토큰 검증 후 실제 변경)
@router.post("/reset-password")
def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)):
    if len(payload.new_password) < 8:
        raise HTTPException(status_code=400, detail="비밀번호는 8자 이상이어야 합니다")

    record = (
        db.query(PasswordResetToken)
        .filter(
            PasswordResetToken.token == payload.token,
            PasswordResetToken.used == False,
            PasswordResetToken.expires_at > datetime.now(timezone.utc),
        )
        .first()
    )

    if not record:
        raise HTTPException(status_code=400, detail="유효하지 않거나 만료된 링크입니다")

    hashed_password = bcrypt.hashpw(payload.new_password.encode("utf-8"), bcrypt.gensalt())

    user = db.query(User).filter(User.id == record.user_id).first()
    user.password = hashed_password.decode("utf-8")

    record.used = True

    db.commit()

    return {"message": "비밀번호가 변경되었습니다."}