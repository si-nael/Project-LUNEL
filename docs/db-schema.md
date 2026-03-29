# Lunel System - Database Schema

## Phase 1 Tables

### users
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK, DEFAULT gen_random_uuid() |
| email | VARCHAR(255) | UNIQUE, NOT NULL |
| password_hash | VARCHAR(255) | NOT NULL |
| name | VARCHAR(100) | NOT NULL |
| role | user_role_enum | NOT NULL |
| class_info | VARCHAR(50) | NULLABLE |
| is_active | BOOLEAN | DEFAULT true |
| created_at | TIMESTAMPTZ | DEFAULT NOW() |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() |

**Enums**: `user_role_enum` = STUDENT, TEACHER, ADMIN, EXTERNAL

### groups
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| name | VARCHAR(200) | NOT NULL |
| type | group_type_enum | NOT NULL |
| owner_user_id | UUID | FK → users.id |
| is_temporary | BOOLEAN | DEFAULT false |
| expires_at | TIMESTAMPTZ | NULLABLE |
| is_active | BOOLEAN | DEFAULT true |
| created_at | TIMESTAMPTZ | DEFAULT NOW() |

**Enums**: `group_type_enum` = SCHOOL, GRADE, CLASS, CLUB, PROJECT_TEAM, TEMPORARY, STAFF

### group_memberships
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| user_id | UUID | FK → users.id, NOT NULL |
| group_id | UUID | FK → groups.id, NOT NULL |
| membership_role | membership_role_enum | DEFAULT 'MEMBER' |
| joined_at | TIMESTAMPTZ | DEFAULT NOW() |
| expires_at | TIMESTAMPTZ | NULLABLE |

**Constraints**: UNIQUE(user_id, group_id)
**Enums**: `membership_role_enum` = OWNER, ADMIN, MEMBER, VIEWER

### visibility_policies
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| scope_type | visibility_scope_enum | NOT NULL |
| allow_public | BOOLEAN | DEFAULT false |
| allow_group_ids | UUID[] | NULLABLE |
| allow_role_names | VARCHAR[] | NULLABLE |
| deny_group_ids | UUID[] | NULLABLE |
| rule_expression_json | JSONB | NULLABLE |
| created_at | TIMESTAMPTZ | DEFAULT NOW() |

**Enums**: `visibility_scope_enum` = PUBLIC, AUTHENTICATED, GROUP_ONLY, ROLE_ONLY, GROUP_AND_ROLE, PROCEDURAL_KEY

### projects
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| title | VARCHAR(300) | NOT NULL |
| description | TEXT | NULLABLE |
| owner_group_id | UUID | FK → groups.id |
| progress_percent | SMALLINT | DEFAULT 0, CHECK(0-100) |
| status | project_status_enum | DEFAULT 'DRAFT' |
| visibility_policy_id | UUID | FK → visibility_policies.id, NULLABLE |
| created_by | UUID | FK → users.id |
| created_at | TIMESTAMPTZ | DEFAULT NOW() |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() |

**Enums**: `project_status_enum` = DRAFT, ACTIVE, PAUSED, COMPLETED, ARCHIVED

### schedules
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| title | VARCHAR(300) | NOT NULL |
| description | TEXT | NULLABLE |
| type | schedule_type_enum | NOT NULL |
| subtype | VARCHAR(50) | NOT NULL |
| start_at | TIMESTAMPTZ | NOT NULL |
| end_at | TIMESTAMPTZ | NULLABLE |
| all_day | BOOLEAN | DEFAULT false |
| timezone | VARCHAR(50) | DEFAULT 'Asia/Seoul' |
| status | schedule_status_enum | DEFAULT 'SCHEDULED' |
| importance_score | SMALLINT | DEFAULT 50 |
| base_importance | SMALLINT | DEFAULT 50 |
| authority_weight | SMALLINT | DEFAULT 0 |
| urgency_weight | SMALLINT | DEFAULT 0 |
| feedback_weight | SMALLINT | DEFAULT 0 |
| dependency_weight | SMALLINT | DEFAULT 0 |
| visibility_policy_id | UUID | FK → visibility_policies.id, NULLABLE |
| creator_id | UUID | FK → users.id |
| project_id | UUID | FK → projects.id, NULLABLE |
| related_event_id | UUID | FK → events.id, NULLABLE |
| location | VARCHAR(200) | NULLABLE |
| metadata | JSONB | NULLABLE |
| created_at | TIMESTAMPTZ | DEFAULT NOW() |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() |

**Enums**:
- `schedule_type_enum` = PROJECT, INTERVAL, EVENT
- `schedule_status_enum` = DRAFT, SCHEDULED, IN_PROGRESS, COMPLETED, CANCELLED

### events
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| event_type | event_type_enum | NOT NULL |
| title | VARCHAR(300) | NOT NULL |
| status | event_status_enum | DEFAULT 'PLANNED' |
| external_source_type | VARCHAR(50) | NULLABLE |
| external_source_id | VARCHAR(200) | NULLABLE |
| result_sync_state | sync_state_enum | DEFAULT 'NOT_SYNCED' |
| created_at | TIMESTAMPTZ | DEFAULT NOW() |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() |

**Enums**:
- `event_type_enum` = COMPETITION, EXHIBITION, CHALLENGE, WORKSHOP, OTHER
- `event_status_enum` = PLANNED, REGISTRATION_OPEN, IN_PROGRESS, JUDGING, COMPLETED, CANCELLED
- `sync_state_enum` = NOT_SYNCED, SYNCING, SYNCED, ERROR

### schedule_event_links
| Column | Type | Constraints |
|--------|------|-------------|
| schedule_id | UUID | FK → schedules.id |
| event_id | UUID | FK → events.id |
| link_type | event_link_type_enum | NOT NULL |

**PK**: (schedule_id, event_id)
**Enums**: `event_link_type_enum` = MAIN, REGISTRATION, RESULT, RELATED

### ratings
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| schedule_id | UUID | FK → schedules.id, NOT NULL |
| user_id | UUID | FK → users.id, NOT NULL |
| score | SMALLINT | CHECK(1-5), NOT NULL |
| usefulness_score | SMALLINT | CHECK(1-5), NULLABLE |
| importance_feedback | SMALLINT | CHECK(1-5), NULLABLE |
| comment | TEXT | NULLABLE |
| created_at | TIMESTAMPTZ | DEFAULT NOW() |

**Constraints**: UNIQUE(schedule_id, user_id)

---

## Phase 2 Tables

### activity_nodes
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| project_id | UUID | FK → projects.id, NOT NULL |
| parent_id | UUID | FK → activity_nodes.id, NULLABLE |
| related_schedule_id | UUID | FK → schedules.id, NULLABLE |
| node_type | node_type_enum | NOT NULL |
| title | VARCHAR(300) | NOT NULL |
| status | node_status_enum | DEFAULT 'TODO' |
| progress | SMALLINT | DEFAULT 0 |
| order_index | INT | DEFAULT 0 |
| created_at | TIMESTAMPTZ | DEFAULT NOW() |

### activity_edges
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| from_node_id | UUID | FK → activity_nodes.id |
| to_node_id | UUID | FK → activity_nodes.id |
| edge_type | edge_type_enum | NOT NULL |

**Constraints**: UNIQUE(from_node_id, to_node_id, edge_type)

### competitions, participants, submissions, scoreboards, sync_jobs, notifications

### competitions
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| event_id | UUID | FK → events.id, NOT NULL |
| max_participants | INT | NULLABLE |
| scoring_rule | JSON | NULLABLE |
| created_at | TIMESTAMPTZ | DEFAULT NOW() |

### participants
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| competition_id | UUID | FK → competitions.id, NOT NULL |
| user_id | UUID | FK → users.id, NOT NULL |
| registered_at | TIMESTAMPTZ | DEFAULT NOW() |
| status | participant_status_enum | DEFAULT 'REGISTERED' |

**Constraints**: UNIQUE(competition_id, user_id)
**Enums**: `participant_status_enum` = REGISTERED, CONFIRMED, WITHDRAWN

### submissions
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| competition_id | UUID | FK → competitions.id, NOT NULL |
| participant_id | UUID | FK → participants.id, NOT NULL |
| content | JSON | NULLABLE |
| score | NUMERIC | NULLABLE |
| submitted_at | TIMESTAMPTZ | DEFAULT NOW() |
| graded_at | TIMESTAMPTZ | NULLABLE |

### scoreboards
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| competition_id | UUID | FK → competitions.id, NOT NULL |
| snapshot_data | JSON | NOT NULL |
| is_final | BOOLEAN | DEFAULT false |
| created_at | TIMESTAMPTZ | DEFAULT NOW() |

### sync_jobs
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| event_id | UUID | FK → events.id, NOT NULL |
| job_type | sync_job_type_enum | NOT NULL |
| status | sync_job_status_enum | DEFAULT 'PENDING' |
| result_summary | JSON | NULLABLE |
| started_at | TIMESTAMPTZ | NULLABLE |
| completed_at | TIMESTAMPTZ | NULLABLE |
| created_at | TIMESTAMPTZ | DEFAULT NOW() |

**Enums**:
- `sync_job_type_enum` = MANUAL, POLLING, WEBHOOK
- `sync_job_status_enum` = PENDING, RUNNING, SUCCESS, FAILED

### notifications
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| user_id | UUID | FK → users.id, NOT NULL |
| type | VARCHAR(50) | NOT NULL |
| title | VARCHAR(300) | NOT NULL |
| body | TEXT | NULLABLE |
| related_schedule_id | UUID | FK → schedules.id, NULLABLE |
| related_project_id | UUID | FK → projects.id, NULLABLE |
| is_read | BOOLEAN | DEFAULT false |
| created_at | TIMESTAMPTZ | DEFAULT NOW() |

---

## Phase 3 Tables
### schedule_history, project_history
(Event sourcing / audit trail tables)
