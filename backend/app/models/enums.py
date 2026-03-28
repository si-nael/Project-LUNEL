import enum


class UserRole(str, enum.Enum):
    STUDENT = "STUDENT"
    TEACHER = "TEACHER"
    ADMIN = "ADMIN"
    EXTERNAL = "EXTERNAL"


class GroupType(str, enum.Enum):
    SCHOOL = "SCHOOL"
    GRADE = "GRADE"
    CLASS = "CLASS"
    CLUB = "CLUB"
    PROJECT_TEAM = "PROJECT_TEAM"
    TEMPORARY = "TEMPORARY"
    STAFF = "STAFF"


class MembershipRole(str, enum.Enum):
    OWNER = "OWNER"
    ADMIN = "ADMIN"
    MEMBER = "MEMBER"
    VIEWER = "VIEWER"


class VisibilityScopeType(str, enum.Enum):
    PUBLIC = "PUBLIC"
    AUTHENTICATED = "AUTHENTICATED"
    GROUP_ONLY = "GROUP_ONLY"
    ROLE_ONLY = "ROLE_ONLY"
    GROUP_AND_ROLE = "GROUP_AND_ROLE"
    PROCEDURAL_KEY = "PROCEDURAL_KEY"


class ProjectStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    ACTIVE = "ACTIVE"
    PAUSED = "PAUSED"
    COMPLETED = "COMPLETED"
    ARCHIVED = "ARCHIVED"


class ScheduleType(str, enum.Enum):
    PROJECT = "PROJECT"
    INTERVAL = "INTERVAL"
    EVENT = "EVENT"


class ScheduleSubtype(str, enum.Enum):
    # PROJECT subtypes
    PERSONAL_PROJECT = "PERSONAL_PROJECT"
    TEAM_PROJECT = "TEAM_PROJECT"
    TEMP_GROUP_PROJECT = "TEMP_GROUP_PROJECT"
    # INTERVAL subtypes
    REGISTRATION_WINDOW = "REGISTRATION_WINDOW"
    EVENT_WINDOW = "EVENT_WINDOW"
    SUBMISSION_WINDOW = "SUBMISSION_WINDOW"
    # EVENT subtypes
    COMPETITION = "COMPETITION"
    PERFORMANCE_TASK = "PERFORMANCE_TASK"
    ASSIGNMENT = "ASSIGNMENT"
    MEETING = "MEETING"
    GENERAL_EVENT = "GENERAL_EVENT"


class ScheduleStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    SCHEDULED = "SCHEDULED"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class EventType(str, enum.Enum):
    COMPETITION = "COMPETITION"
    EXHIBITION = "EXHIBITION"
    CHALLENGE = "CHALLENGE"
    WORKSHOP = "WORKSHOP"
    OTHER = "OTHER"


class EventStatus(str, enum.Enum):
    PLANNED = "PLANNED"
    REGISTRATION_OPEN = "REGISTRATION_OPEN"
    IN_PROGRESS = "IN_PROGRESS"
    JUDGING = "JUDGING"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class SyncState(str, enum.Enum):
    NOT_SYNCED = "NOT_SYNCED"
    SYNCING = "SYNCING"
    SYNCED = "SYNCED"
    ERROR = "ERROR"


class EventLinkType(str, enum.Enum):
    MAIN = "MAIN"
    REGISTRATION = "REGISTRATION"
    RESULT = "RESULT"
    RELATED = "RELATED"


# Phase 2 enums

class NodeType(str, enum.Enum):
    MILESTONE = "MILESTONE"
    TASK = "TASK"
    SUB_TASK = "SUB_TASK"


class NodeStatus(str, enum.Enum):
    TODO = "TODO"
    IN_PROGRESS = "IN_PROGRESS"
    DONE = "DONE"
    BLOCKED = "BLOCKED"


class EdgeType(str, enum.Enum):
    HIERARCHY = "HIERARCHY"
    DEPENDS_ON = "DEPENDS_ON"
    BLOCKS = "BLOCKS"
    REFERS_TO = "REFERS_TO"
