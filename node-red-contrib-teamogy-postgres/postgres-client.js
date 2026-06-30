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
	
	function buildQuery(sql, qs, sqlData, sqlColumns, sqlColumnsUpdate) {
		const escapeCol = col => '"' + String(col).replace(/"/g, '""') + '"';
		const DATA_PH  = '{data}';
		const COL_PH   = '{columns}';
		const UPCOL_PH = '{columnsUpdate}';

		if (sqlColumnsUpdate !== undefined && qs.includes(UPCOL_PH)) {
			qs = qs.replace(UPCOL_PH, sqlColumnsUpdate.map(col =>
				escapeCol(col) + ' = EXCLUDED.' + escapeCol(col)
			).join(', '));
		}

		const hasDataPH = qs.includes(DATA_PH);
		const hasColsPH = qs.includes(COL_PH);

		if (sqlData !== undefined) {
			const rows    = Array.isArray(sqlData) ? sqlData : [sqlData];
			const columns = sqlColumns ? [].concat(sqlColumns) : Object.keys(rows[0]);

			if (hasColsPH && hasDataPH) {
				if (/\binsert\b/i.test(qs)) {
					const colList = '(' + columns.map(escapeCol).join(', ') + ')';
					const params  = [];
					const values  = rows.map(row =>
						'(' + columns.map(col => { params.push(row[col]); return '$' + params.length; }).join(', ') + ')'
					).join(', ');
					return sql.unsafe(qs.replace(COL_PH, colList).replace(DATA_PH, values), params);
				} else {
					const strippedQs = qs.replace(COL_PH, '');
					const fragment = sql(sqlData, columns);
					const idx = strippedQs.indexOf(DATA_PH);
					return sql`${sql.unsafe(strippedQs.slice(0, idx))}${fragment}${sql.unsafe(strippedQs.slice(idx + DATA_PH.length))}`;
				}
			}

			if (hasDataPH) {
				const fragment = sqlColumns ? sql(sqlData, sqlColumns) : sql(sqlData);
				const idx = qs.indexOf(DATA_PH);
				return sql`${sql.unsafe(qs.slice(0, idx))}${fragment}${sql.unsafe(qs.slice(idx + DATA_PH.length))}`;
			}

			if (hasColsPH) {
				return sql.unsafe(qs.replace(COL_PH, columns.map(escapeCol).join(', ')));
			}

			// no placeholders: append Builder to end
			const fragment = sqlColumns ? sql(sqlData, sqlColumns) : sql(sqlData);
			return sql`${sql.unsafe(qs)} ${fragment}`;
		}

		// sqlData not set: {columns} from sqlColumns
		if (hasColsPH && sqlColumns) {
			return sql.unsafe(qs.replace(COL_PH, sqlColumns.map(escapeCol).join(', ')));
		}

		return sql.unsafe(qs);
	}

	function postgresClient(config) {
		try {
			var node = this;
			
			RED.nodes.createNode(node,config);
			this.config = RED.nodes.getNode(config.configuration);
			this.debug = config.debug;

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
					ssl: node.config.ssl ? 'require' : false,
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

			node.on('input', async function(msg, send, done) {
				send = send || node.send.bind(node);

				if (!sql) {
					done(new Error("No database connection"));
					return;
				}

				const qs = msg.payload;

				if (typeof qs !== 'string' || !qs.trim()) {
					done(new Error("msg.payload must be a non-empty SQL string"));
					return;
				}

				if (msg.sql !== undefined) {
					if (typeof msg.sql !== 'object' || msg.sql === null || Array.isArray(msg.sql)) {
						done(new Error("msg.sql must be a plain object"));
						return;
					}
					if (msg.sql.data !== undefined) {
						const t = typeof msg.sql.data;
						if (msg.sql.data === null || t !== 'object') {
							done(new Error("msg.sql.data must be an object or array"));
							return;
						}
					}
					if (msg.sql.columns !== undefined) {
						if (!Array.isArray(msg.sql.columns) || msg.sql.columns.length === 0) {
							done(new Error("msg.sql.columns must be a non-empty array"));
							return;
						}
					}
					if (msg.sql.columnsUpdate !== undefined) {
						if (!Array.isArray(msg.sql.columnsUpdate) || msg.sql.columnsUpdate.length === 0) {
							done(new Error("msg.sql.columnsUpdate must be a non-empty array"));
							return;
						}
					}
				}

				const isDynamic = msg.sql !== undefined;

				if (node.debug) {
					const sqlData          = msg.sql?.data;
					const sqlColumns       = msg.sql?.columns;
					const sqlColumnsUpdate = msg.sql?.columnsUpdate;
					let displaySql = qs;
					if (sqlData !== undefined && qs.includes('{columns}') && qs.includes('{data}')) {
						const rows = Array.isArray(sqlData) ? sqlData : [sqlData];
						const cols = sqlColumns ? [].concat(sqlColumns) : Object.keys(rows[0]);
						if (/\binsert\b/i.test(qs)) {
							let p = 0;
							displaySql = qs
								.replace('{columns}', '(' + cols.join(', ') + ')')
								.replace('{data}', rows.map(() =>
									'(' + cols.map(() => '$' + ++p).join(', ') + ')'
								).join(', '));
						} else {
							let p = 0;
							displaySql = qs
								.replace('{columns}', '')
								.replace('{data}', cols.map(col => col + '=$' + ++p).join(', '));
						}
					} else if (sqlData !== undefined && qs.includes('{columns}') && !qs.includes('{data}')) {
						const rows = Array.isArray(sqlData) ? sqlData : [sqlData];
						const cols = sqlColumns ? [].concat(sqlColumns) : Object.keys(rows[0]);
						displaySql = qs.replace('{columns}', cols.join(', '));
					} else if (sqlData === undefined && sqlColumns !== undefined) {
						displaySql = qs.includes('{columns}')
							? qs.replace('{columns}', sqlColumns.join(', '))
							: qs + ' ' + sqlColumns.join(', ');
					}
					if (sqlColumnsUpdate !== undefined && displaySql.includes('{columnsUpdate}')) {
						const updateFrag = sqlColumnsUpdate.map(col => col + ' = EXCLUDED.' + col).join(', ');
						displaySql = displaySql.replace('{columnsUpdate}', updateFrag);
					}
					const debugInfo = { sql: displaySql };
					if (sqlData !== undefined)          debugInfo.data          = sqlData;
					if (sqlColumns !== undefined)       debugInfo.columns       = sqlColumns;
					if (sqlColumnsUpdate !== undefined) debugInfo.columnsUpdate = sqlColumnsUpdate;
					node.warn(JSON.stringify(debugInfo));
				}

				const doAsyncJobs = async () => {
					try {
						let q;
						if (isDynamic) {
							q = await buildQuery(sql, qs, msg.sql.data, msg.sql.columns, msg.sql.columnsUpdate);
						} else {
							q = await sql`${sql.unsafe(qs)}`.simple();
						}
						node.status({fill: "green", shape: "dot", text: "query ok"});
						return [0, q];
					} catch (e) {
						node.status({fill: "red", shape: "ring", text: "query error"});
						return [1, e];
					}
				};

				const r = await doAsyncJobs();

				if (r[0] === 0) {
					msg.payload = Array.from(r[1]);
					msg.count = msg.payload.length;
					delete msg.error;
					send(msg);
					done();
				} else {
					const e = r[1];
					msg.payload = '';
					msg.error = {
						message: e.message,
						code: e.code,
						detail: e.detail,
						hint: e.hint
					};
					msg.count = 0;
					send(msg);
					done(e);
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
