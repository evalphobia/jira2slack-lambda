var request = require('request'),
  config = require('../config.json'),
  colors = require('./colors'),
  converter = require('./converter');

module.exports = {
  notify(context, sender, msg) {
    var data = converter.convert(msg);

    // 有効なイベントでなければ終了
    if (!data.isValidEvent) {
      context.done();
      return;
    }
    data.sender = sender;
    console.log(JSON.stringify(data));

    // イベント送信者・チャンネル非対象者を除外する
    var targets = {}
    targets = removeSender(data.eventName, data.sender, data.targets);
    targets = removeNonChannel(targets);

    var channels = Object.keys(targets).filter(function (key) {
      return !!config.channels[key]
    });
    if (channels.length == 0) {
      context.done();
      return;
    }

    // テスト用に返却
    if (!context) {
      return channels;
    }

    console.log('channels: ' + JSON.stringify(channels));
    // 各ユーザーのチャンネルに投稿
    channels.forEach(function (user) {
      var requestData = {};
      requestData = createNewSlackData(data, user);

      console.log(user + ': ' + JSON.stringify(requestData))

      request(requestData, function () {
        context.done();
      });
    })
  },
}

// 通知送信の対象者を取得する
function getTargets(msg) {
  var targetMap = {};

  var user = getUser(msg); // イベント送信者
  targetMap[user.key] = true;

  var creator = getCreator(msg); // 作成者
  targetMap[creator.key] = true;

  var assignee = getAssignee(msg); // アサイン
  targetMap[assignee.key] = true;

  var commenter = getCommentAuthoer(msg); // コメント作成者
  targetMap[commenter.key] = true;
  return targetMap;
}

// 発言者を除外する
function removeSender(eventName, sender, targets) {
  // 作成関連のイベントの場合は、発言者でも除外しない
  switch (eventName) {
    case 'jira:issue_created':
      return targets;
  }

  delete targets[sender]
  return targets;
}

// チャンネル対象者以外を除外する
function removeNonChannel(targets) {
  var validList = {};
  Object.keys(targets).forEach(function (key) {
    if (!config.channels[key]) {
      return;
    }
    validList[key] = true;
  });
  return validList;
}

// 対象のユーザーについてGithubユーザー名をSlackユーザー名に変換する
function convertName(body, target) {
  return body.replace(/~[a-zA-Z0-9_\-]+/g, function (key) {
    var name = key.substring(1);
    var slackName = config.account_map[name];
    var isTarget = (name == target)
    name = slackName ? slackName : name;
    name = isTarget ? '@' + name : name;
    return name
  });
}

function createNewSlackData(data, user) {
  var defaultName = 'じら';
  var payload = {
    url: config.slack_web_hook_url,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    json: {
      channel: config.channels[user],
      username: defaultName,
      icon_emoji: getDefaultIcon(),
      link_names: 1
    }
  };

  var sender = data.sender;
  payload.json.attachments = slackAttachData(data, user);
  if (config.icon_map[sender]) {
    payload.json.icon_emoji = getUserIcon(sender);
    payload.json.username = sender;
    payload.json.attachments.thumb_url = payload.json.icon_emoji;
  }

  return payload;
}

function slackAttachData(data, user) {
  attach = {};
  attach.author_name = 'by ' + data.sender;
  attach.pretext = slackPretext(data);
  attach.title = data.summary;
  attach.title_link = data.url;
  attach.fallback = attach.title + ' (' + attach.title_link + ')';
  attach.color = slackColor(data);
  attach.fields = slackFields(data);
  attach.footer = data.key;

  if (data.isCreate) {
    attach.text = convertName(data.description, user);
  } else if (!!data.comment) {
    attach.text = convertName(data.comment, user);
  }

  return [attach];
}

function slackPretext(data) {
  if (data.isCreate) {
    return 'Issue created';
  }
  return 'Issue updated';
}

function slackColor(data) {
  if (data.isCreate) {
    return colors['AirforceBlue'];
  }

  if (!data.change) return;

  switch (data.change.event) {
    case 'assignee':
      return colors['GrannySmithApple'];
    case 'status':
      return colors['citrine'];
  }
  return colors['PaleSilver'];
}

function slackFields(data) {
  var fields = [];

  if (!!data.creator) {
    fields.push({
      "title": "Creator",
      "value": data.creator,
      "short": true,
    });
  }

  if (!!data.assignee) {
    fields.push({
      "title": "Assignee",
      "value": data.assignee,
      "short": true,
    });
  }

  if (!!data.duedate) {
    fields.push({
      "title": "Duedate",
      "value": data.duedate,
      "short": true,
    });
  }

  if (!!data.change) {
    fields.push({
      "title": data.change.event,
      "value": data.change.from + ' -> ' + data.change.to,
      "short": true,
    });
  }

  return fields;
}

function getUserIcon(name) {
  var val = config.icon_map[name];
  return getRandom(val);
}

function getDefaultIcon() {
  return getRandom(config.icons);
}

function getRandom(arr) {
  if (!Array.isArray(arr)) {
    return arr;
  }

  var keys = Object.keys(arr);
  var index = keys[Math.floor(Math.random() * keys.length)];
  return arr[index];
}