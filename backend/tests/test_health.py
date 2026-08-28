from django.urls import reverse


def test_health_endpoint_is_public_and_reports_service(client):
    response = client.get(reverse("health"))

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "service": "b-photo-api",
        "version": "0.1.0",
    }
