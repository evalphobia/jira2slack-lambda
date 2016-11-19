var config = require('../config.json');

module.exports = {
    // 有効な種類のイベントかどうか
    isValidEvent: function (msg) {
        if (!msg) return false;

        var eventName = msg.webhookEvent;
        switch (eventName) {
            case 'jira:issue_created':
                return !!config.enable_created;
            case 'jira:issue_updated':
                return !!config.enable_updated;
        }
        return false;
    },

    // 有効な種類のチェンジイベントかどうか
    isValidChange: function (data) {
        if (data.isCreate) return true;
        if (!data.isChange) return false;
        if (data.change !== 'status') return true;

        return config.valid_status[data.change.to];
    },

    // パラメータ変換
    convert: function (msg) {
        var data = {};
        data.isValidEvent = true;
        if (!this.isValidEvent(msg)) {
            data.isValidEvent = false;
            return data;
        }
        data.isCreate = isCreate(msg);

        // チェンジイベント
        data.isChange = hasChangeLog(msg)
        data.change = getChageItem(msg)
        if (!this.isValidChange(data)) {
            data.isValidEvent = false;
            return data;
        }

        data.eventName = msg.webhookEvent; // イベント名
        data.key = getKey(msg); // JIRaチケットキー

        // targets
        data.user = getUser(msg); // イベント送信者
        data.creator = getCreator(msg); // 作成者
        data.assignee = getAssignee(msg); // アサイン
        data.commenter = getCommentAuthoer(msg); // コメント作成者

        data.comment = getComment(msg);
        data.description = getDescription(msg);

        data.mentions = getMentions(data.body) // コメント内メンション
        data.targets = getTargetMap(data); // 全関係者

        data.summary = getSummary(msg); // 概要
        data.url = getUrl(msg); // URL

        data.priority = getPriority(msg);
        data.duedate = getDuedate(msg);

        return data;
    },
}

function isCreate(msg) {
    if (!msg) return false;
    return msg.webhookEvent === 'jira:issue_created';
}

function getKey(msg) {
    if (!msg.issue) return;
    return msg.issue.key || '';
}

function getUser(msg) {
    if (!msg.user) return
    return msg.user.key || undefined
}

function getCreator(msg) {
    if (!msg.issue) return
    if (!msg.issue.fields) return
    if (!msg.issue.fields.creator) return
    return msg.issue.fields.creator.key || undefined
}

function getAssignee(msg) {
    if (!msg.issue) return
    if (!msg.issue.fields) return
    if (!msg.issue.fields.assignee) return
    return msg.issue.fields.assignee.key || undefined
}

function getCommentAuthoer(msg) {
    if (!msg.comment) return
    if (!msg.comment.author) return
    return msg.comment.author.key || undefined
}

function getMentions(body) {
    if (!body) return [];

    var targets = {}
    var mentions = body.match(/~[a-zA-Z0-9_-]+/g) || [];
    mmentions.map(function (key) {
        return key.substring(1);
    }).forEach(function (v) {
        targets[v] = true;
    });

    return Object.keys(targets);
}

function getTargetMap(data) {
    var targets = {}

    targets[data.sender] = true;
    targets[data.creator] = true;
    targets[data.assignee] = true;
    targets[data.commenter] = true;
    data.mentions.forEach(function (v) {
        targets[v] = true;
    });

    return targets;
}

function getComment(msg) {
    if (!msg) return ''
    if (!msg.comment) return ''
    return msg.comment.body || '';
}

function getDescription(msg) {
    if (!msg) return ''
    if (!msg.issue) return ''
    if (!msg.issue.fields) return ''
    return msg.issue.fields.description || ''
}

function getSummary(msg) {
    if (!msg.issue) return '';
    if (!msg.issue.fields) return '';
    return msg.issue.fields.summary || '';
}

function getUrl(msg) {
    if (!msg.issue) return '';
    if (!msg.issue.self) return '';
    return msg.issue.self.split('/rest/')[0] + '/browse/' + msg.issue.key;
}

function getPriority(msg) {
    if (!msg.issue) return
    if (!msg.issue.fields) return
    if (!msg.issue.fields.priority) return
    return msg.issue.fields.priority.name || undefined
}

function getDuedate(msg) {
    if (!msg.issue) return
    if (!msg.issue.fields) return
    return msg.issue.fields.duedate || undefined
}

function hasChangeLog(msg) {
    if (!msg.changelog) return false;
    if (!msg.changelog) return false;
    if (!msg.changelog.items) return false;
    return !!msg.changelog.items[0];
}

function getChageItem(msg) {
    if (!hasChangeLog(msg)) return;

    var items = msg.changelog.items;
    for (var i in items) {
        var item = items[i];
        switch (item.field) {
            case 'assignee':
                return changeItem(item);
            case 'status':
                return changeItem(item);
        }
    }
}

function changeItem(item) {
    return {
        event: item.field,
        from: item.fromString,
        to: item.toString,
    };
}