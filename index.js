/* jshint: indent:2 */
var request = require('request'),
    config  = require('./config.json');

var colors = {
  // blue
  'navy': '#000080',
  'AirforceBlue': '#5d8aa8',
  'PastelBlue': '#aec6cf',
  // red
  'amaranth': '#e52b50',
  'mulberry': '#c54b8c',
  'LightPink': '#ffb6c1',
  'OldRose': '#c08081',
  // yellow
  'citrine': '#e4d00a',
  'eggshell': '#f0ead6',
  // green
  'DollerBill': '#85bb65',
  'GrannySmithApple': '#a8e4a0',
  'MagicMint': '#aaf0d1',
  'JungleGreen': '#29ab87',
  // purple
  'LavenderBlue': '#ccccff',
  // other
  'onyx': '#0f0f0f',
  'PaleSilver': '#c9c0bb',
};

/**
  main routine
*/
var App = 
{
  handler: function (event, context) {
    console.log("invoke App.handler")
    console.log("event: " + JSON.stringify(event));
    if (typeof event.body === 'string') {
      event.body = JSON.parse(event.body);
    }

    App.runMain(context, event.user_key, event.body);
  },

  runMain: function(context, sender, msg){
    var data = Converter.convert(msg);

    // 有効なイベントでなければ終了
    if (!data.isValidEvent) {
      context.done();
      return;
    }
    data.sender = sender;
    console.log(JSON.stringify(data));

    // イベント送信者・チャンネル非対象者を除外する
    var targets = {}
    targets = App.removeSender(data.eventName, data.sender, data.targets);
    targets = App.removeNonChannel(targets);

    var channels = Object.keys(targets).filter(function(key){
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

    console.log('channels: '+ JSON.stringify(channels));
    // 各ユーザーのチャンネルに投稿
    channels.forEach(function(user){
      var requestData = {};
      requestData = App.createNewSlackData(data, user);

      console.log(user +': '+ JSON.stringify(requestData))

      request(requestData, function () {
        context.done();
      });
    })
  },

  // 通知送信の対象者を取得する
  getTargets: function(msg){
    var targetMap = {};

    var user = App.getUser(msg); // イベント送信者
    targetMap[user.key] = true;

    var creator = App.getCreator(msg); // 作成者
    targetMap[creator.key] = true;

    var assignee = App.getAssignee(msg); // アサイン
    targetMap[assignee.key] = true;

    var commenter = App.getCommentAuthoer(msg); // コメント作成者
    targetMap[commenter.key] = true;
    return targetMap;
  },


  // 発言者を除外する
  removeSender: function(eventName, sender, targets){
    // 作成関連のイベントの場合は、発言者でも除外しない
    switch (eventName) {
      case 'jira:issue_created':
        return targets;
    }

    delete targets[sender]
    return targets;
  },

  // チャンネル対象者以外を除外する
  removeNonChannel: function(targets){
    var validList = {};
    Object.keys(targets).forEach(function(key){
      if (!config.channels[key]) {
        return;
      }
      validList[key] = true;
    });
    return validList;
  },

  // 対象のユーザーについてGithubユーザー名をSlackユーザー名に変換する
  convertName: function (body, target) {
    return body.replace(/~[a-zA-Z0-9_\-]+/g, function (key) {
      var name = key.substring(1);
      var slackName = config.account_map[name];
      var isTarget = (name == target)
      name = slackName ? slackName : name;
      name = isTarget ? '@' + name : name;
      return name
    });
  },

  createNewSlackData: function (data, user) {
    var defaultName = 'じら';
    var payload = {
      url: config.slack_web_hook_url,
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      json: {
        channel: config.channels[user],
        username: defaultName,
        icon_emoji: App.getDefaultIcon(),
        link_names: 1
      }
    };

    var sender = data.sender;
    payload.json.attachments = App.slackAttachData(data, user);
    if (config.icon_map[sender]){
      payload.json.icon_emoji = App.getUserIcon(sender);
      payload.json.username = sender;
      payload.json.attachments.thumb_url = payload.json.icon_emoji;
    }

    return payload;
  },

  slackAttachData: function (data, user) {
    attach = {};
    attach.author_name = 'by '+ data.sender;
    attach.pretext = App.slackPretext(data);
    attach.title = data.summary;
    attach.title_link = data.url;
    attach.fallback = attach.title + ' (' + attach.title_link + ')';
    attach.color = App.slackColor(data);
    attach.fields = App.slackFields(data);
    attach.footer = data.key;

    if (data.isCreate) {
      attach.text = App.convertName(data.description, user);
    } else if (!!data.comment) {
      attach.text = App.convertName(data.comment, user);
    }

    return [attach];
  },

  slackPretext: function (data) {
    if (data.isCreate) {
      return 'Issue created';
    }
    return 'Issue updated';
  },

  slackColor: function (data) {
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
  },

  slackFields: function (data) {
    var fields = [];

    if (!!data.creator){
      fields.push({
        "title": "Creator",
        "value": data.creator,
        "short": true,
      });
    }

    if (!!data.assignee){
      fields.push({
        "title": "Assignee",
        "value": data.assignee,
        "short": true,
      });
    }

    if (!!data.duedate){
      fields.push({
        "title": "Duedate",
        "value": data.duedate,
        "short": true,
      });
    }

    if (!!data.change){
      fields.push({
        "title": data.change.event,
        "value": data.change.from +' -> '+ data.change.to,
        "short": true,
      });
    }

    return fields;
  },

  getUserIcon: function (name) {
    var val = config.icon_map[name];
    return App.getRandom(val);
  },

  getDefaultIcon: function () {
    return App.getRandom(config.icons);
  },

  getRandom: function (arr) {
    if (!Array.isArray(arr)) {
      return arr;
    }

    var keys = Object.keys(arr);
    var index = keys[Math.floor(Math.random() * keys.length)];
    return arr[index];
  }
}

module.exports = App



/**
   request converter
*/
var Converter = 
{

  // 有効な種類のイベントかどうか
  isValidEvent: function(msg){
    if (!msg) return false;

    var eventName = msg.webhookEvent;
    switch (eventName) {
      case 'jira:issue_created':
      case 'jira:issue_updated':
        return true;
    }
    return false;
  },

  // 有効な種類のチェンジイベントかどうか
  isValidChange: function(data){
    return data.isCreate || data.isChange;
  },

  // パラメータ変換
  convert: function(msg){
    var data = {};
    data.isValidEvent = true;
    if (!Converter.isValidEvent(msg)) {
      data.isValidEvent = false;
      return data;
    }
    data.isCreate = Converter.isCreate(msg);

    // チェンジイベント
    data.isChange =  Converter.hasChangeLog(msg)
    data.change =  Converter.getChageItem(msg)
    if (!Converter.isValidChange(data)) {
      data.isValidEvent = false;
      return data;
    }

    data.eventName = msg.webhookEvent; // イベント名
    data.key = Converter.getKey(msg); // JIRaチケットキー

    // targets
    data.user = Converter.getUser(msg); // イベント送信者
    data.creator = Converter.getCreator(msg); // 作成者
    data.assignee = Converter.getAssignee(msg); // アサイン
    data.commenter = Converter.getCommentAuthoer(msg); // コメント作成者

    data.comment = Converter.getComment(msg);
    data.description = Converter.getDescription(msg);

    data.mentions = Converter.getMentions(data.body) // コメント内メンション
    data.targets = Converter.getTargetMap(data); // 全関係者

    data.summary = Converter.getSummary(msg); // 概要
    data.url = Converter.getUrl(msg); // URL

    data.priority = Converter.getPriority(msg);
    data.duedate = Converter.getDuedate(msg);

    return data;
  },

  isCreate: function (msg) {
    if (!msg) return false;
    return msg.webhookEvent === 'jira:issue_created';
  },

  getKey: function (msg) {
    if (!msg.issue) return;
    return msg.issue.key || '';
  },

  getUser: function(msg){
    if (!msg.user) return
    return msg.user.key || undefined
  },

  getCreator: function(msg){
    if (!msg.issue) return
    if (!msg.issue.fields) return
    if (!msg.issue.fields.creator) return
    return msg.issue.fields.creator.key || undefined
  },

  getAssignee: function(msg){
    if (!msg.issue) return
    if (!msg.issue.fields) return
    if (!msg.issue.fields.assignee) return
    return msg.issue.fields.assignee.key || undefined
  },

  getCommentAuthoer: function(msg){
    if (!msg.comment) return
    if (!msg.comment.author) return
    return msg.comment.author.key || undefined
  },

  getMentions: function (body) {
    if (!body) return [];

    var targets = {}
    var mentions = body.match(/~[a-zA-Z0-9_-]+/g) || [];
    mmentions.map(function(key){
      return key.substring(1);
    }).forEach(function(v){
      targets[v] = true;
    });

    return Object.keys(targets);
  },

  getTargetMap: function (data) {
    var targets = {}

    targets[data.sender] = true;
    targets[data.creator] = true;
    targets[data.assignee] = true;
    targets[data.commenter] = true;
    data.mentions.forEach(function(v){
      targets[v] = true;
    });

    return targets;
  },

  getComment: function (msg) {
    if (!msg) return ''
    if (!msg.comment) return ''
    return msg.comment.body || '';
  },

  getDescription: function (msg) {
    if (!msg) return ''
    if (!msg.issue) return ''
    if (!msg.issue.fields) return ''
    return msg.issue.fields.description || ''
  },

  getSummary: function (msg) {
    if (!msg.issue) return '';
    if (!msg.issue.fields) return '';
    return msg.issue.fields.summary || '';
  },

  getUrl: function (msg) {
    if (!msg.issue) return '';
    if (!msg.issue.self) return '';
    return msg.issue.self.split('/rest/')[0] + '/browse/' + msg.issue.key;
  },

  getPriority: function(msg){
    if (!msg.issue) return
    if (!msg.issue.fields) return
    if (!msg.issue.fields.priority) return
    return msg.issue.fields.priority.name || undefined
  },

  getDuedate: function(msg){
    if (!msg.issue) return
    if (!msg.issue.fields) return
    return msg.issue.fields.duedate || undefined
  },

  hasChangeLog: function(msg){
    if (!msg.changelog) return false;
    if (!msg.changelog) return false;
    if (!msg.changelog.items) return false;
    return !!msg.changelog.items[0];
  },

  getChageItem: function(msg){
    if (!Converter.hasChangeLog(msg)) return;

    var items = msg.changelog.items;
    for (var i in items) {
      var item = items[i];
      switch (item.field) {
        case 'assignee':
          return Converter.changeItem(item);
        case 'status':
          return Converter.changeItem(item);
      }
    }
  },

  changeItem: function(item){
    return {
      event: item.field,
      from: item.fromString,
      to: item.toString,
    };
  }
}
