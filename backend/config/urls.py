from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/v1/schema", SpectacularAPIView.as_view(), name="api-schema"),
    path("api/v1/", include("apps.common.urls")),
]
