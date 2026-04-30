from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("projects", "0002_alter_project_group_projectmembership_and_more"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="project",
            name="group",
        )
    ]
