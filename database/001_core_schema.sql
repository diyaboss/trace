-- Oracle XE 11g 11.2.0.2. Run only in a NEW, empty dedicated schema.
-- This is not a migration: do not run it against existing application objects.
WHENEVER SQLERROR EXIT SQL.SQLCODE ROLLBACK
DECLARE
    existing_objects PLS_INTEGER;
BEGIN
    IF USER IN ('SYS', 'SYSTEM') OR SYS_CONTEXT('USERENV', 'CURRENT_SCHEMA') <> USER THEN
        RAISE_APPLICATION_ERROR(-20002, 'Connect directly as a dedicated application/test user.');
    END IF;
    SELECT COUNT(*) INTO existing_objects FROM user_objects;
    IF existing_objects <> 0 THEN
        RAISE_APPLICATION_ERROR(-20003, 'Schema is not empty. Stop; this script does not migrate existing objects.');
    END IF;
END;
/
CREATE SEQUENCE seq_department START WITH 1000 INCREMENT BY 1 MAXVALUE 9999999999 NOCYCLE CACHE 20;
CREATE SEQUENCE seq_employee START WITH 1000 INCREMENT BY 1 MAXVALUE 9999999999 NOCYCLE CACHE 20;
CREATE SEQUENCE seq_threat_actor START WITH 1000 INCREMENT BY 1 MAXVALUE 9999999999 NOCYCLE CACHE 20;
CREATE SEQUENCE seq_incident START WITH 1000 INCREMENT BY 1 MAXVALUE 9999999999 NOCYCLE CACHE 20;
CREATE TABLE DEPARTMENT (
    department_id NUMBER(10) NOT NULL,
    department_name VARCHAR2(120 CHAR) NOT NULL,
    CONSTRAINT pk_department PRIMARY KEY (department_id),
    CONSTRAINT ck_department_id CHECK (department_id > 0),
    CONSTRAINT ck_department_name CHECK (TRIM(department_name) IS NOT NULL)
);
CREATE TABLE EMPLOYEE (
    employee_id NUMBER(10) NOT NULL,
    first_name VARCHAR2(80 CHAR) NOT NULL,
    last_name VARCHAR2(80 CHAR) NOT NULL,
    email VARCHAR2(254 CHAR) NOT NULL,
    designation VARCHAR2(120 CHAR),
    department_id NUMBER(10) NOT NULL,
    CONSTRAINT pk_employee PRIMARY KEY (employee_id),
    CONSTRAINT ck_employee_id CHECK (employee_id > 0),
    CONSTRAINT ck_employee_name CHECK (TRIM(first_name) IS NOT NULL AND TRIM(last_name) IS NOT NULL),
    CONSTRAINT uq_employee_email UNIQUE (email),
    CONSTRAINT fk_employee_department FOREIGN KEY (department_id) REFERENCES DEPARTMENT(department_id)
);
CREATE TABLE THREAT_ACTOR (
    threat_actor_id NUMBER(10) NOT NULL,
    actor_name VARCHAR2(160 CHAR) NOT NULL,
    actor_type VARCHAR2(80 CHAR),
    suspected_origin VARCHAR2(120 CHAR),
    CONSTRAINT pk_threat_actor PRIMARY KEY (threat_actor_id),
    CONSTRAINT ck_threat_actor_id CHECK (threat_actor_id > 0),
    CONSTRAINT ck_threat_actor_name CHECK (TRIM(actor_name) IS NOT NULL)
);
CREATE TABLE INCIDENT (
    incident_id NUMBER(10) NOT NULL,
    title VARCHAR2(160 CHAR) NOT NULL,
    description CLOB,
    severity VARCHAR2(8 CHAR) NOT NULL,
    status VARCHAR2(13 CHAR) NOT NULL,
    detected_at TIMESTAMP(3) WITH TIME ZONE NOT NULL,
    resolved_at TIMESTAMP(3) WITH TIME ZONE,
    employee_id NUMBER(10) NOT NULL,
    threat_actor_id NUMBER(10),
    CONSTRAINT pk_incident PRIMARY KEY (incident_id),
    CONSTRAINT ck_incident_id CHECK (incident_id > 0),
    CONSTRAINT ck_incident_title CHECK (TRIM(title) IS NOT NULL),
    CONSTRAINT ck_incident_severity CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    CONSTRAINT ck_incident_status CHECK (status IN ('OPEN', 'INVESTIGATING', 'CONTAINED', 'RESOLVED')),
    CONSTRAINT ck_incident_resolution CHECK ((status = 'RESOLVED' AND resolved_at IS NOT NULL) OR (status <> 'RESOLVED' AND resolved_at IS NULL)),
    CONSTRAINT ck_incident_time CHECK (resolved_at IS NULL OR resolved_at >= detected_at),
    CONSTRAINT fk_incident_employee FOREIGN KEY (employee_id) REFERENCES EMPLOYEE(employee_id),
    CONSTRAINT fk_incident_actor FOREIGN KEY (threat_actor_id) REFERENCES THREAT_ACTOR(threat_actor_id)
);
CREATE INDEX ix_employee_department ON EMPLOYEE(department_id);
CREATE INDEX ix_incident_employee ON INCIDENT(employee_id);
CREATE INDEX ix_incident_actor ON INCIDENT(threat_actor_id);
CREATE INDEX ix_incident_detected ON INCIDENT(detected_at DESC, incident_id DESC);
