module.exports = function(RED) {

	var nodemailer = require('nodemailer');
	
	function ConnectionNode(n) {
		try {
			RED.nodes.createNode(this, n);
			
			const node = this;
			
			this.name = n.name;
			this.host = n.host;
			this.port = n.port;
			this.ssl = n.ssl;
			if (node.credentials) {
				this.user = this.credentials.user;
				this.password = this.credentials.password;
			}
			
		} catch (e) {
			node.error(e);
		}
	}
  
	RED.nodes.registerType('email-config', ConnectionNode, {
		credentials: {
			user: {type: 'text'},
			password: {type: 'password'}
		}
	});
	
	function emailClient(config) {
		try {
			var node = this;
			
			RED.nodes.createNode(node,config);
			node.config = RED.nodes.getNode(config.configuration);
			
			let transport;
			try {		
					transport = nodemailer.createTransport({
					host: node.config.host,
					port: node.config.port,
					secure: node.config.ssl,
					auth: {
						user: node.config.user,
						pass: node.config.password,
					}
				});
			} catch (error) {
				node.error(error);
				node.status({fill: "red", shape: "ring", text: "transport error"});
			}
			
			node.on('input', function(msg) {
				try {
					let from = ''
					if (typeof msg?.from != 'undefined') { from = msg.from; }
					else if (typeof msg?.payload?.from != 'undefined') { from = msg.payload.from; }
					else if(typeof msg?.email?.from != 'undefined') { from = msg.email.from; }
					else {
						node.status({fill: "red", shape: "ring", text: "error"});
						node.error('from is undefined');
						return
					}
					
					let to = ''
					if (typeof msg?.to != 'undefined') { to = msg.to; }
					else if (typeof msg?.payload?.to != 'undefined') { to = msg.payload.to; }
					else if(typeof msg?.email?.to != 'undefined') { to = msg.email.to; }
					else {
						node.status({fill: "red", shape: "ring", text: "error"});
						node.error('to is undefined');
						return
					}

					let cc = ''
					if (typeof msg?.cc != 'undefined') { cc = msg.cc; }
					else if (typeof msg?.payload?.cc != 'undefined') { cc = msg.payload.cc; }
					else if(typeof msg?.email?.cc != 'undefined') { cc = msg.email.cc; }
					
					let bcc = ''
					if (typeof msg?.bcc != 'undefined') { bcc = msg.bcc; }
					else if (typeof msg?.payload?.bcc != 'undefined') { bcc = msg.payload.bcc; }
					else if(typeof msg?.email?.bcc != 'undefined') { bcc = msg.email.bcc; }

					
					let replyTo = ''
					if (typeof msg?.replyTo != 'undefined') { replyTo = msg.replyTo; }
					else if (typeof msg?.payload?.replyTo != 'undefined') { replyTo = msg.payload.replyTo; }
					else if(replyTo) { replyTo = msg.email.replyTo; }

					
					let subject = ''
					if (typeof msg?.subject != 'undefined') { subject = msg.subject; }
					else if (typeof msg?.payload?.subject != 'undefined') { subject = msg.payload.subject; }
					else if(typeof msg?.email?.subject != 'undefined') { subject = msg.email.subject; }
					else if(typeof msg?.topic != 'undefined') { subject = msg.topic; }
					else {
						node.status({fill: "red", shape: "ring", text: "error"});
						node.error('subject is undefined');
						return;
					}

					let text = ''
					if (typeof msg?.text != 'undefined') { text = msg.text; }
					else if (typeof msg?.payload?.text != 'undefined') { text = msg.payload.text; }
					else if(typeof msg?.email?.text != 'undefined') { text = msg.email.text; }
					
					let html = ''
					if (typeof msg?.html != 'undefined') { html = msg.html; }
					else if (typeof msg?.payload?.html != 'undefined') { html = msg.payload.html; }
					else if(typeof msg?.email?.html != 'undefined') { html = msg.email.html; }
					else if(typeof msg?.payload != 'undefined') { html = msg.payload; }
					
					let attachments = []
					if (typeof msg?.attachments != 'undefined') { attachments = msg.attachments; }
					else if (typeof msg?.payload?.attachments != 'undefined') { attachments = msg.payload.attachments; }
					else if(typeof msg?.email?.attachments != 'undefined') { attachments = msg.email.attachments; }
					
					let mailOptions = {
						from: from, 
						to: to, 
						cc: cc,
						bcc: bcc,
						replyTo: replyTo,
						subject: subject, 
						attachments: attachments
					};
					
					if(html.length > 0) { mailOptions.html = html } else { if(text.length > 0) { mailOptions.text = text } }
					
					let newMsg = JSON.parse(JSON.stringify(msg))

					transport.sendMail(mailOptions, (error, info) => {
						if (error) {
							node.status({fill: "red", shape: "ring", text: "error"});
							node.error(error, msg);
						} else {
							node.status({fill: "green", shape: "dot", text: "ok"});
							newMsg.payload = info
							node.send(JSON.parse(JSON.stringify(newMsg)));
						}
					});
				} catch (e) {
					node.error(e);
				}
			});
		
		} catch (e) {
			node.error(e);
		}	
	}
			
	RED.nodes.registerType("email-client",emailClient);
}