module.exports = function(RED) {

	var postgres = require('postgres');
	
	function ConnectionNode(n) {
		try {
			RED.nodes.createNode(this, n);
			
			const node = this;
			
			this.name = n.name;
			this.host = n.host;
			this.port = n.port;
			this.ssl = n.ssl;
			this.db = n.db;
			this.maxconnections = n.maxconnections;
			this.idletimeout = n.idletimeout;
			this.connectiontimeout = n.connectiontimeout;
			if (this.credentials) {
				this.user = this.credentials.user;
				this.password = this.credentials.password;
			}
		
		} catch (e) {
			node.error(e);
		}
	}
  
	RED.nodes.registerType('postgres-config', ConnectionNode, {
		credentials: {
			user: {type: 'text'},
			password: {type: 'password'}
		}
	});
	
	function postgresClient(config) {
		try {
			var node = this;
			
			RED.nodes.createNode(node,config);
			this.config = RED.nodes.getNode(config.configuration);

			if (!this.config) {
				node.error("Missing or invalid postgres configuration");
				node.status({fill: "red", shape: "ring", text: "no config"});
				return;
			}

			let sql
			try {
				sql = postgres({
					host: node.config.host,
					port: node.config.port,
					database: node.config.db,
					username: node.config.user,
					password: node.config.password,
					ssl: node.config.ssl,
					max: node.config.maxconnections,
					connection: {
						application_name: "tf-pg-" + node.id
					},
					idle_timeout: node.config.idletimeout,
					connect_timeout: node.config.connectiontimeout
				});
			} catch (error) {
				node.error(error);
				node.status({fill: "red", shape: "ring", text: "connect error"});
			}

			node.on('input', async function(msg) {

				if (!sql) {
					node.error("No database connection", msg);
					return;
				}

				const qs = msg.payload;

				if (typeof qs !== 'string' || !qs.trim()) {
					node.error("msg.payload must be a non-empty SQL string", msg);
					return;
				}

				const doAsyncJobs = async () => {
					try {
						const q = await sql`${sql.unsafe(qs)}`.simple();
						node.status({fill: "green", shape: "dot", text: "query ok"});
						return [0, q];
					} catch (e) {
						node.error(e, msg);
						node.status({fill: "red", shape: "ring", text: "query error"});
						return [1, e];
					}
				};

				const r = await doAsyncJobs();

				if (r[0] === 0) {
					msg.payload = r[1];
					msg.count = r[1].length;
					delete msg.error;
					node.send(msg);
				} else if (r[0] === 1) {
					const e = r[1];
					msg.payload = '';
					msg.error = {
						message: e.message,
						code: e.code,
						detail: e.detail,
						hint: e.hint
					};
					msg.count = 0;
					node.send(msg);
				}

			});

			node.on('close', async function(done) {
				if (sql) {
					await sql.end();
				}
				done();
			});

		} catch (e) {
			node.error(e);
		}
	}
	
	RED.nodes.registerType("postgres-client",postgresClient);
}
