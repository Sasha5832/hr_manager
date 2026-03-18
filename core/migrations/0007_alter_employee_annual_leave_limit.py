

from django .db import migrations ,models 


class Migration (migrations .Migration ):

    dependencies =[
    ('core','0006_employee_annual_leave_limit'),
    ]

    operations =[
    migrations .AlterField (
    model_name ='employee',
    name ='annual_leave_limit',
    field =models .PositiveIntegerField (default =26 ,help_text ='Roczny limit dni urlopu (dni robocze)'),
    ),
    ]
