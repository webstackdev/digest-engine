import re

with open('projects/ninja_api.py', 'r') as f:
    text = f.read()

writable_fn = """def _require_project_writable(request: Any, project_id: int) -> Project:
    \"\"\"Load one project, requiring admin or member (write) access.\"\"\"
    project = _get_project_or_404(request, project_id)
    membership = ProjectMembership.objects.filter(
        project=project, user=request.user
    ).first()
    if not membership or membership.role not in {ProjectRole.ADMIN, ProjectRole.MEMBER}:
        raise HttpError(403, "You do not have permission to perform this action.")
    return project

"""
text = text.replace('def _require_project_admin(request: Any, project_id: int) -> Project:', writable_fn + 'def _require_project_admin(request: Any, project_id: int) -> Project:')

with open('projects/ninja_api.py', 'w') as f:
    f.write(text)
