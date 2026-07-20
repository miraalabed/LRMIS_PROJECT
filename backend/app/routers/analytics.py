from fastapi import APIRouter, Depends
from typing import Optional
from app.services import analytics_service as svc
from app.services import geo_service
from app.utils.security import require_back_office

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/kpis")
def kpis(current_user=Depends(require_back_office)):
    return svc.get_kpis()


@router.get("/applications-by-status")
def by_status(current_user=Depends(require_back_office)):
    return svc.applications_by_status()


@router.get("/applications-by-zone")
def by_zone(current_user=Depends(require_back_office)):
    return svc.applications_by_zone()


@router.get("/processing-time")
def proc_time(current_user=Depends(require_back_office)):
    return svc.processing_time()


@router.get("/surveyors")
def surveyors(current_user=Depends(require_back_office)):
    return svc.surveyor_stats()


@router.get("/registrars")
def registrars(current_user=Depends(require_back_office)):
    return svc.registrar_stats()



@router.get("/geofeeds/parcels")
def geofeed_parcels(zone: Optional[str] = None, status: Optional[str] = None, current_user=Depends(require_back_office)):
   
    return geo_service.get_parcels_geojson(zone=zone, status=status)


@router.get("/geofeeds/pending-heatmap")
def geofeed_pending_heatmap(current_user=Depends(require_back_office)):
   
    return geo_service.get_pending_heatmap()
