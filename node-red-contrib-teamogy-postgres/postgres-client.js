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
					idle_timeout: node.config.idletimeout,
					connect_timeout: node.config.connectiontimeout
				});
			} catch (error) {
				node.error(error);
				node.status({fill: "red", shape: "ring", text: "connect error"});
			}

			node.on('input', async function(msg) {
    
    			const qs = msg.payload; // SQL dotaz z payloadu původní zprávy

    		const doAsyncJobs = async () => {
        		try {
            		const q = await sql`${sql.unsafe(qs)}`.simple();
            		node.status({fill: "green", shape: "dot", text: "query ok"});
            		return [0, q]; // Status 0 pro úspěch, q je výsledek
        		} catch (e) {
            		node.error(e.message, msg); // Předat msg do node.error pro lepší kontext chyby v Node-RED
            		node.status({fill: "red", shape: "ring", text: "query error"});
            	return [1, e]; // Status 1 pro chybu, e je objekt chyby
        				}
    		};

		    const r = await doAsyncJobs();

    		if (r[0] === 0) { 
        		msg.payload = JSON.parse(JSON.stringify(r[1])); 
        		msg.count = r[1].length;
        		delete msg.error;      
        		node.send(msg);        
    		} else if (r[0] === 1) { 
        		msg.payload = '';    
        		msg.error = r[1].message;
        		msg.count = 0;           
        		node.send(msg);          
    	}
    
		});
			
		} catch (e) {
			node.error(e);
		}
	}
	
	RED.nodes.registerType("postgres-client",postgresClient);
}