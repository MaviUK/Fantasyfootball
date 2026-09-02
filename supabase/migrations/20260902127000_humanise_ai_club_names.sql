with ai_names(old_name, new_name) as (
  values
    ('AI Club 01', 'Ctrl Alt De Ligt'),
    ('AI Club 02', 'No Kane No Gain'),
    ('AI Club 03', 'Expected Toulouse'),
    ('AI Club 04', 'Pique Blinders'),
    ('AI Club 05', 'Murder on Zidane''s Floor'),
    ('AI Club 06', 'Tea & Busquets'),
    ('AI Club 07', 'Game of Throw-Ins'),
    ('AI Club 08', 'Lads on Toure'),
    ('AI Club 09', 'Haaland & Oates'),
    ('AI Club 10', 'Rice Rice Baby'),
    ('AI Club 11', 'Son of a Pitch'),
    ('AI Club 12', 'Back of the Neto'),
    ('AI Club 13', 'Bowen Arrow'),
    ('AI Club 14', 'The Neville Wears Prada'),
    ('AI Club 15', 'When Harry Met Alli'),
    ('AI Club 16', 'Klopp of the Pops'),
    ('AI Club 17', 'Onana What''s My Name'),
    ('AI Club 18', 'Shaw Thing'),
    ('AI Club 19', 'Gakpo''s Army')
)
update public.game_clubs gc
set name = n.new_name,
    updated_at = now()
from ai_names n
where gc.manager_type = 'ai'
  and gc.name = n.old_name;
