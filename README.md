jira2slack-lambda
----

The lambda function to send JIRA event message to Slack.

![description image](https://raw.github.com/wiki/evalphobia/jira2slack-lambda/images/jira-slack.png)

## Setting

- Slack
    - Setting [Incoming Webhook](https://slack.com/apps/A0F7XDUAZ-incoming-webhooks)
- AWS Lambda
    - Configure and deploy code in this repo.
    - Add event source of SNS.
- AWS API Gateway
    - Create resource `POST /event`.
    - Add `user_id` to URL Query String Parameters in `Method Request`.
    - Set lambda function in `Integration Request`.
- JIRA
    - Add [Webhook](https://your-team-name.atlassian.net/plugins/servlet/webhooks) with event of Issue `created` and `updated` and set url for API Gateway.


## Configuration

### config.json

```bash
$ cp ./config.json.sample ./config.json
$ cat ./config.json

{
  // set your slack hook url
  "slack_web_hook_url": "https://hooks.slack.com/services/<your>/<slack>/<endpoint>",

  // set channels for each user.
  "channels": {
    "jira_name": "#slack-channel",
    "evalphobia": "#xxx-takuma"
  },

  // set account to change mention name from jira to slack.
  "account_map": {
    "jira_name": "slack_name",
    "evalphobia": "takuma"
  },

  // set icons for the user of slack.
  "icon_map": {
    "jira_name": ":baby:",
    "evalphobia": [":walking:", ":dancer:", ":bell:"]
  },

  // set default icons except for icon_map.
  "icons": [
    ":smile:",
    ":v:",
    ":pray:"
  ]
}
```


### lambda-config.js

```bash
$ npm install

...


$ cp ./lambda-config.js.sample ./lambda-config.js
$ cat ./lambda-config.js

module.exports = {
  // Set AWS access key and secret key or env/sgared credential is used.
  accessKeyId: <access key id>,  // optional
  secretAccessKey: <secret access key>,  // optional

  // Set profile name if you use particualr profile in shared credential. ($HOME/.aws/credentials)
  profile: <shared credentials profile name>, // optional for loading AWS credientail from custom profile

  region: 'us-east-1',
  handler: 'index.handler',
  role: "arn:aws:iam::000000000000:role/<role name>",
  functionName: <lambda function name>,
  timeout: 10,
  memorySize: 128
}
```


## Deploy

```bash
$ ./node_modules/.bin/gulp deploy
```

# LICENSE

This software is released under the MIT License, see LICENSE
