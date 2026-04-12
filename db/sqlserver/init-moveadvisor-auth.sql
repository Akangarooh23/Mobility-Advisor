IF OBJECT_ID(N'dbo.MoveAdvisorUsers', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.MoveAdvisorUsers (
    Id NVARCHAR(64) NOT NULL PRIMARY KEY,
    Name NVARCHAR(120) NOT NULL,
    Email NVARCHAR(255) NOT NULL UNIQUE,
    PasswordSalt NVARCHAR(64) NOT NULL,
    PasswordHash NVARCHAR(200) NOT NULL,
    CreatedAt DATETIME2 NOT NULL,
    LastLoginAt DATETIME2 NOT NULL
  );

  CREATE UNIQUE INDEX IX_MoveAdvisorUsers_Email ON dbo.MoveAdvisorUsers (Email);
END;
