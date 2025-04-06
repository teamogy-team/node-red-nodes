# PostgreSQL node for Node-RED

Connect to PostgreSQL database.

You must configure Connection before using this node.

## Connection Configuration

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| Name | string | Optional | Enter a name or it will be generated on first save |
| Server | string | Required | Enter the hostname of server or IP address |
| Port | number | Required | Enter the port number to connect |
| TLS | checkbox | Optional | If checked, the connection will use TLS when connecting to the server |
| Database | string | Required | Enter the database |
| User | string | Required | Enter the username |
| Password | string | Required | Enter the user's password |
| Max. number of connections | number | Required | Enter the value between 1 and 100, default is 10 |
| Idle connection timeout (s) | number | Required | Enter the value between 0 and 60, default is 0 |
| Connection timeout (s) | number | Required | Enter the value between 1 and 600, default is 30 |

## Input Message Format

You can send SQL commands in the following way:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| msg.payload | string | Required | SQL command(s) |

You can send one SQL command, for example:
```sql
UPDATE users SET phone = '+420222551500' WHERE id = 15
```

Or multiple commands separated by a semicolon:
```sql
SELECT * FROM users WHERE id = 15; SELECT * FROM groups WHERE group_name = 'accounting'
```

## Output Message

| Parameter | Type | Description |
|-----------|------|-------------|
| msg.payload | string \| object | The standard output from postgres server |
| msg.count | number | The count of records or count of arrays |
| msg.error | string | The error from postgres client or server |

### Response Details

- If you send one command, you will get a response in `msg.payload` as an array of records and number of records in `msg.count`
- If you send multiple commands, you will get a response in `msg.payload` as an array of arrays and number of arrays in `msg.count`
- If you send a command that does not return values, you will get a response in `msg.payload` as empty array and number of records in `msg.count` will be 0
- If any error in postgres client or server occurs, it will be sent in `msg.error`

## References

- [Teamogy Flow docs](https://teamogy.com/teamogy-flow) - full description of Teamogy Flow
- [PostgreSQL docs](https://www.postgresql.org/docs/) - full description of PostgreSQL
