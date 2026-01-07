# Teamogy API Node

Node for connecting to the Teamogy API.

## Connection Configuration

You must configure a Connection before using this node.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| Name | string | Optional | You can enter a name or it will be generated on first save |
| Subdomain | string | Required | Enter the name of the subdomain and the domain, in the format: subdomain.domain.com |
| Unit/Agency | number | Required | Enter the number of unit or agency |
| Token | string | Required | Enter the generated API token for the given subdomain and Unit/Agency |
| Req/min | number | Required | Enter the maximum number of API requests per minute for the given subdomain, if the limit is greater than allowed, further requests will be rejected (not processed) |

## Input

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| Name | string | Optional | You can enter a name for the given node (recommended) |
| Connection | selection - list | Required | Select the configured connection |
| Request views | checkbox - yes/no | Required | Check for requests for API views (see description below) |
| Token | selection - list | Required | Select the desired entity |
| Req/min | selection - list | Required | Select an available method |
| Source | selection - list | Required | The parameters or even the request body can be static, i.e. from the Params and Body fields in the form, or dynamic as part of the input message |
| Source of body | string | Required | The parameter set the source of the body, default is msg.payload |
| Params | string \| object | Optional | You can enter the params in the case of a static request as a string, in the case of a dynamic also as an object, according to the API specification for the given entity |
| Body | JSON string \| object | Optional | You can enter the body in the case of a static request as a JSON string, in the case of a dynamic also as an object, you can nest objects and arrays in the body without restrictions according to the API specification for the given entity |
| Merge | checkbox - yes/no | Optional | Check if you want the output message to contain all returned records. In the background, processing is still taking place according to the Paging settings, but individual messages are not sent to the output, but only the final merged one containing all the returned records. (if not specified the value no is used) |
| Limit | number | Optional | Limitation of the total number of records in the response (if not specified, the value 0 is used, the value 0 means no limit) |
| Paging | number | Optional | Division of responses into multiple parts with the number of records returned (if not specified, the value 1000 is used) |
| Offset | number | Optional | Determining from which records to return, e.g. if you have a total of 100 records and want to return records 50-100, set Offset to 50, if you want to return all records leave the option at 0 (if not specified, the value 0 is used) |
| Delay | number | Optional | Specifies the delay between requests, which is used for pagination (if not specified, the value 0 is used) |
| Req. repeat | number | Optional | Specifies the number of errors after which the request will be repeated (if not specified, the value 5 is used) |
| Req. delay (s) | number | Optional | Specifies the delay between requests, which is used when retrying a request in case of an error (if not specified, the value 30 is used) |
| Skip | boolean | Optional, in message only | Adding the msg.skip=true will allow the message to pass through to the output without processing |
| Connection | string | Optional, in message only | Replaces connection from configuration, use connection name |
| Unit | number | Optional, in message only | Replaces unit from connection configuration, use unit/agency id |
| Entity | string | Optional, in message only | Replaces entity from configuration, use v_entityName for views or r_entityName |
| Method | string | Optional, in message only | Replaces method from configuration, use the available method for the given entity |
			
## Examples

### Static Request Examples

Enter the desired values according to the selected entity and method in the Params field. Values for Params are listed on separate lines:

```
id=3
registration=12345678
```

For API views:

```
columns=firstName,lastName
externalFilter=id>5
```

For Body field (JSON):

```json
{
  "id": 3,
  "registration": 12345678
}
```

### Dynamic Request Examples

For API views, as string:
```
id=2&name=John
```

Or as an object:
```javascript
msg.params.id = 2
msg.params.name = "John"
```

For Body, as JSON string:
```json
{"id": 3, "name": "John"}
```

Or as an object:
```javascript
msg.body.id = 2
msg.body.name = "John"
msg.body.address = addresses // array of objects
```

## Output

| Property | Type | Description |
|----------|------|-------------|
| payload | string \| object | The standard output of the response |
| count | number | Number of records in the output |
| error | string | Rrror message |
| msg.* | string \| object | All properties of the input message |

## References

- [Teamogy Flow docs](https://teamogy.com/teamogy-flow) - full description of Teamogy Flow
- [Teamogy API docs](https://readme.teamogy.com/reference/integration-options) - full description of parameters for `msg.params` and `msg.body` properties, and also options for API views
