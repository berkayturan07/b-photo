from drf_spectacular.utils import extend_schema
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView


class HealthView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    @extend_schema(
        responses={
            200: {
                "type": "object",
                "properties": {
                    "status": {"type": "string", "example": "ok"},
                    "service": {"type": "string", "example": "b-photo-api"},
                    "version": {"type": "string", "example": "0.1.0"},
                },
                "required": ["status", "service", "version"],
            }
        },
        tags=["Sistem"],
    )
    def get(self, request):
        return Response(
            {
                "status": "ok",
                "service": "b-photo-api",
                "version": "0.1.0",
            }
        )
