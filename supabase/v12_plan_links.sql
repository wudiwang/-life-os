begin;
update work_todos set project_id='d0fcafdc-7324-4380-8f90-f607a36df966'
where project_id is null and id in (
 '2c902d85-4a9c-436e-9304-0a61a2e8a2d3',
 '06ecda29-851b-4a13-aa10-da8f1f8f45e2',
 'c7e45e1a-3f64-43e8-bc30-17d81ed892ff',
 '166abdb0-b20b-4efa-93d8-da2c1f897a5c',
 '375895f9-52ff-450f-844e-c8f40a1c9e12')
and exists(select 1 from journal_threads where id='d0fcafdc-7324-4380-8f90-f607a36df966' and track='work');
update work_todos set project_id='f3a3c96f-fe78-4ce9-801f-7d67fb68ff2d'
where project_id is null and id='128ebd7f-5ab5-4cb5-bb4f-d51ec9c1354d'
and exists(select 1 from journal_threads where id='f3a3c96f-fe78-4ce9-801f-7d67fb68ff2d' and track='life');
commit;
