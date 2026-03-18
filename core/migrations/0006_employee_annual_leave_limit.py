

from django .db import migrations ,models 


class Migration (migrations .Migration ):

    dependencies =[
    ('core','0005_alter_performancereview_options_and_more'),
    ]

    operations =[
    migrations .AddField (
    model_name ='employee',
    name ='annual_leave_limit',
    field =models .PositiveIntegerField (default =26 ,help_text ='Roczny limit dni urlopu'),
    ),
    ]
