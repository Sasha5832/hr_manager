

from django .db import migrations 


class Migration (migrations .Migration ):

    dependencies =[
    ('core','0007_alter_employee_annual_leave_limit'),
    ]

    operations =[
    migrations .RemoveField (
    model_name ='employee',
    name ='annual_leave_limit',
    ),
    ]
