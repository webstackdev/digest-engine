from ninja import Router

project_router = Router()

@project_router.get("/{project_id}/hello")
def hello(request, project_id: int):
    return {"project_id": project_id}
