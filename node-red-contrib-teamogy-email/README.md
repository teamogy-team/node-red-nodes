# SMTP node for Node-RED

Connect to SMTP server and send emails.

You must configure the Connection before using this node.

## Connection Configuration

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| Name | string | Optional | A name for the connection (auto-generated if not provided) |
| Server | string | Required | Hostname of server or IP address |
| Port | number | Required | Port number to connect |
| TLS | checkbox | Optional | If checked, the connection will use TLS when connecting to the server. If unchecked (default), then TLS is used if the server supports the STARTTLS extension. In most cases, set this value to checked if you are connecting to port 465. For port 587 or 25, leave the value unchecked |
| User | string | Required | Username |
| Password | string | Required | User's password |

## Input Message Format

Due to backward compatibility with other nodes, it is possible to send parameter values in the input message in several ways described below. The first parameter value is always used in the order listed, and individual ways can be combined in one input message.

### Required Fields

| Parameter | Type | Available Properties | Description |
|-----------|------|---------------------|-------------|
| From | string | `msg.from`, `msg.payload.from`, `msg.email.from` | Email address of the sender |
| To | string | `msg.to`, `msg.payload.to`, `msg.email.to` | Email address of recipient(s), multiple recipients separated by a comma |
| Subject | string | `msg.subject`, `msg.payload.subject`, `msg.email.subject`, `msg.topic` | Text of subject (Unicode string) |

### Optional Fields

| Parameter | Type | Available Properties | Description |
|-----------|------|---------------------|-------------|
| CC | string | `msg.cc`, `msg.payload.cc`, `msg.email.cc` | Carbon copy recipients, multiple addresses separated by a comma |
| BCC | string | `msg.bcc`, `msg.payload.bcc`, `msg.email.bcc` | Blind carbon copy recipients, multiple addresses separated by a comma |
| Reply-To | string | `msg.replyTo`, `msg.payload.replyTo`, `msg.email.replyTo` | Reply-to address(es), multiple addresses separated by a comma |
| Text | string | `msg.text`, `msg.payload.text`, `msg.email.text` | Email body in plaintext (Unicode string) |
| HTML | string | `msg.html`, `msg.payload.html`, `msg.email.html`, `msg.payload` | Email body in HTML format (Unicode string) |

**Note:** HTML content takes precedence over Text content when both are provided.

### Attachments

Attachments can be added using `msg.attachments`, `msg.payload.attachments`, or `msg.email.attachments` as an array of objects.

Examples:

```javascript
attachments: [
  {   // utf-8 string as an attachment
    filename: 'text1.txt',
    content: 'file content text'
  },
  {   // binary buffer as an attachment
    filename: 'text2.txt',
    content: new Buffer('file content text', 'utf-8')
  },
  {   // file on disk as an attachment
    filename: 'text3.txt',
    path: '/path/to/file.txt' // stream this file
  },
  {   // filename and content type is derived from path
    path: '/path/to/file.txt'
  },
  {   // stream as an attachment
    filename: 'text4.txt',
    content: fs.createReadStream('file.txt')
  },
  {   // define custom content type for the attachment
    filename: 'text.bin',
    content: 'file content text',
    contentType: 'text/plain'
  },
  {   // use URL as an attachment
    filename: 'license.txt',
    path: 'https://readme.teamogy.com/docs/licence'
  },
  {   // encoded string as an attachment
    filename: 'text1.txt',
    content: 'VGVhbW9neSBGbG93',
    encoding: 'base64'
  },
  {   // data uri as an attachment
    path: 'data:text/plain;base64,VGVhbW9neSBGbG93'
  },
  {   // use pregenerated MIME node
    raw: 'Content-Type: text/plain\r\n' +
    'Content-Disposition: attachment;\r\n' +
    '\r\n' +
    'file content text'
  }
]
```

## Output Message

| Parameter | Type | Description |
|-----------|------|-------------|
| payload | string \| object | The standard output or error of the response |

## References

- [Teamogy Flow docs](https://teamogy.com/teamogy-flow) - full description of Teamogy Flow
