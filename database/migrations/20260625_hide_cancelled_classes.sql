create or replace view v_student_topic_performance as
select
    s.student_id,
    s.student_code,
    s.full_name as student_name,

    c.class_id,
    c.class_name,

    sub.subject_id,
    sub.subject_name,

    lt.topic_id,
    lt.topic_name,

    count(aq.question_id) as total_questions,
    sum(sa.score) as total_score,
    sum(aq.max_score) as max_score,

    round(
        case
            when sum(aq.max_score) = 0 then 0
            else (sum(sa.score) / sum(aq.max_score)) * 100
        end,
        2
    ) as mastery_percent

from student_answers sa
join assignment_questions aq
    on sa.question_id = aq.question_id
join learning_topics lt
    on aq.topic_id = lt.topic_id
join subjects sub
    on lt.subject_id = sub.subject_id
join assignment_submissions asub
    on sa.submission_id = asub.submission_id
join students s
    on asub.student_id = s.student_id
join assignments a
    on asub.assignment_id = a.assignment_id
join classes c
    on a.class_id = c.class_id
    and c.status <> 'cancelled'

group by
    s.student_id,
    s.student_code,
    s.full_name,
    c.class_id,
    c.class_name,
    sub.subject_id,
    sub.subject_name,
    lt.topic_id,
    lt.topic_name;

create or replace view v_student_weak_topics as
select *
from v_student_topic_performance
where mastery_percent < 60;

create or replace view v_student_assignment_summary as
select
    s.student_id,
    s.student_code,
    s.full_name as student_name,

    c.class_id,
    c.class_name,

    a.assignment_id,
    a.title as assignment_title,
    a.total_score as assignment_total_score,

    asub.status as submission_status,
    asub.total_score as student_score,

    round(
        case
            when a.total_score = 0 then 0
            else (asub.total_score / a.total_score) * 100
        end,
        2
    ) as score_percent,

    asub.teacher_feedback,
    asub.submitted_at,
    asub.graded_at

from assignment_submissions asub
join students s
    on asub.student_id = s.student_id
join assignments a
    on asub.assignment_id = a.assignment_id
join classes c
    on a.class_id = c.class_id
    and c.status <> 'cancelled';
