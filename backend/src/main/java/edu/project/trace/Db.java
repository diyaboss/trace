package edu.project.trace;

import java.sql.*;
import java.util.Properties;

public final class Db {
    private final String url, user, password;
    public Db(String url, String user, String password) {
        if (url == null || !url.startsWith("jdbc:oracle:thin:")) throw new IllegalArgumentException("Set an Oracle JDBC Thin URL.");
        if (user == null || user.isBlank() || password == null || password.isBlank()) throw new IllegalArgumentException("Set the database username and password.");
        if (user.equalsIgnoreCase("SYS") || user.equalsIgnoreCase("SYSTEM")) throw new IllegalArgumentException("Use a dedicated application schema.");
        this.url = url; this.user = user; this.password = password;
    }
    public static Db environment(String prefix) {
        return new Db(System.getenv(prefix + "URL"), System.getenv(prefix + "USER"), System.getenv(prefix + "PASSWORD"));
    }
    public Connection open() throws SQLException {
        Properties properties = new Properties();
        properties.setProperty("user", user); properties.setProperty("password", password);
        properties.setProperty("oracle.net.CONNECT_TIMEOUT", "5000");
        properties.setProperty("oracle.jdbc.ReadTimeout", "10000");
        return DriverManager.getConnection(url, properties);
    }
    public void health() throws SQLException {
        try (Connection connection = open(); PreparedStatement statement = connection.prepareStatement("SELECT 1 FROM DUAL"); ResultSet rows = statement.executeQuery()) {
            if (!rows.next() || rows.getInt(1) != 1) throw new SQLException("Health query failed");
        }
    }
}
