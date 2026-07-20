from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import traceback
from app.routers import applicants, applications, staff, survey, analytics, certificates
import app.routers.auth as auth
import app.routers.parcels as parcels
import app.indexes

app = FastAPI(
    title="LRMIS Backend",
    description="Land Registration Management Information System",
    version="1.0.0"
)

@app.middleware("http")
async def catch_errors(request: Request, call_next):
    try:
        return await call_next(request)
    except Exception as e:
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"error": str(e)})

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(applicants.router)
app.include_router(applications.router)
app.include_router(staff.router)
app.include_router(survey.router)
app.include_router(survey.tasks_router)
app.include_router(analytics.router)
app.include_router(certificates.router)
app.include_router(auth.router)
app.include_router(parcels.router)

@app.get("/")
def root():
    return {"message": "LRMIS API is running "}
