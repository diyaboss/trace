-- Manual SQL*Plus setup only. Connect as SYSTEM before running this script.
-- Refuses an existing TRACE_APP; never ALTERs/DROPs a user.
-- Password stays local. Use a password without " or & for this substitution-based script.
SET ECHO OFF
SET VERIFY OFF
SPOOL OFF
WHENEVER SQLERROR EXIT SQL.SQLCODE ROLLBACK
DECLARE
    existing_users PLS_INTEGER;
BEGIN
    SELECT COUNT(*) INTO existing_users FROM dba_users WHERE username = 'TRACE_APP';
    IF existing_users <> 0 THEN
        RAISE_APPLICATION_ERROR(-20001, 'TRACE_APP already exists. Stop and inspect; do not modify it with this setup.');
    END IF;
END;
/
ACCEPT trace_app_password CHAR PROMPT 'New TRACE_APP password (local, hidden): ' HIDE
CREATE USER trace_app IDENTIFIED BY "&trace_app_password"
    DEFAULT TABLESPACE users
    TEMPORARY TABLESPACE temp
    QUOTA 100M ON users;
UNDEFINE trace_app_password
GRANT CREATE SESSION, CREATE TABLE, CREATE SEQUENCE TO trace_app;
PROMPT TRACE_APP created. Connect as TRACE_APP and run the read-only JDBC probe first.
-- No tables/sequences are created by this script. No CONNECT/RESOURCE/DBA grants.
