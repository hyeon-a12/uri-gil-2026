from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from database import engine, Base
from routers import auth, clips, videos, routes, spots

Base.metadata.create_all(bind=engine)

# 이 프로젝트엔 Alembic 같은 마이그레이션 도구가 없어서, create_all()은 새
# 테이블만 만들 뿐 이미 있는 테이블에 새 컬럼을 추가하진 못합니다. 소규모
# 스키마 변경은 앱 시작 시 이렇게 직접 반영합니다 — IF NOT EXISTS라 여러 번
# 실행돼도(재배포마다) 안전합니다.
with engine.begin() as conn:
    conn.execute(text("ALTER TABLE clips ADD COLUMN IF NOT EXISTS duration_ms INTEGER"))

app = FastAPI(title="우리길 API")

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 라우터 연결
app.include_router(auth.router)
app.include_router(clips.router)
app.include_router(videos.router)
app.include_router(routes.router)
app.include_router(spots.router)

@app.get("/")
def root():
    return {"message": "우리길 API 서버 정상 작동 중"}