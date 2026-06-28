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
		const DATA_PH    = '{data}';
		const COL_PH     = '{columns}';
		const UPCOL_PH   = '{columnsUpdate}';

		if (sqlColumnsUpdate !== undefined && qs.includes(UPCOL_PH)) {
			const updateFrag = sqlColumnsUpdate.map(col =>
				escapeCol(col) + ' = EXCLUDED.' + escapeCol(col)
			).join(', ');
			qs = qs.replace(UPCOL_PH, updateFrag);
		}

		const hasDataPH = qs.includes(DATA_PH);
		const hasColsPH = qs.includes(COL_PH);

		if (sqlData !== undefined) {
			const rows    = Array.isArray(sqlData) ? sqlData : [sqlData];
			const columns = sqlColumns ? [].concat(sqlColumns) : Object.keys(rows[0]);

			if (hasDataPH && hasColsPH) {
				if (/\binsert\b/i.test(qs)) {
					// INSERT: {columns} → ("col1","col2")   {data} → ($1,$2),($3,$4)
					const colList = '(' + columns.map(escapeCol).join(', ') + ')';
					const params  = [];
					const values  = rows.map(row =>
						'(' + columns.map(col => { params.push(row[col]); return '$' + params.length; }).join(', ') + ')'
					).join(', ');
					return sql.unsafe(qs.replace(COL_PH, colList).replace(DATA_PH, values), params);
				} else {
					// UPDATE/other: {columns} stripped, {data} via Builder using columns as filter
					const strippedQs = qs.replace(COL_PH, '');
					const fragment = sql(sqlData, columns);
					const idx = strippedQs.indexOf(DATA_PH);
					return sql`${sql.unsafe(strippedQs.slice(0, idx))}${fragment}${sql.unsafe(strippedQs.slice(idx + DATA_PH.length))}`;
				}
			}

			// Only {data}: use postgres.js Builder (handles INSERT/UPDATE context via keyword detection)
			const fragment = sqlColumns ? sql(sqlData, sqlColumns) : sql(sqlData);
			if (hasDataPH) {
				const idx = qs.indexOf(DATA_PH);
				return sql`${sql.unsafe(qs.slice(0, idx))}${fragment}${sql.unsafe(qs.slice(idx + DATA_PH.length))}`;
			}
			return sql`${sql.unsafe(qs)} ${fragment}`;
		}

		// sqlColumns only → dynamic SELECT columns
		const escapedCols = sqlColumns.map(escapeCol).join(', ');
		const finalSql = hasColsPH ? qs.replace(COL_PH, escapedCols) : qs + ' ' + escapedCols;
		return sql.unsafe(finalSql);
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

				if (msg.sqlData !== undefined) {
					const t = typeof msg.sqlData;
					if (msg.sqlData === null || (t !== 'object')) {
						node.error("msg.sqlData must be an object or array", msg);
						return;
					}
				}

				if (msg.sqlColumns !== undefined) {
					if (!Array.isArray(msg.sqlColumns) || msg.sqlColumns.length === 0) {
						node.error("msg.sqlColumns must be a non-empty array", msg);
						return;
					}
				}

				if (msg.sqlColumnsUpdate !== undefined) {
					if (!Array.isArray(msg.sqlColumnsUpdate) || msg.sqlColumnsUpdate.length === 0) {
						node.error("msg.sqlColumnsUpdate must be a non-empty array", msg);
						return;
					}
				}

				const isDynamic = msg.sqlData !== undefined || msg.sqlColumns !== undefined || msg.sqlColumnsUpdate !== undefined;

				if (node.debug) {
					let displaySql = qs;
					if (msg.sqlData !== undefined && qs.includes('{columns}') && qs.includes('{data}')) {
						const rows = Array.isArray(msg.sqlData) ? msg.sqlData : [msg.sqlData];
						const cols = msg.sqlColumns ? [].concat(msg.sqlColumns) : Object.keys(rows[0]);
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
					} else if (msg.sqlData === undefined && msg.sqlColumns !== undefined) {
						displaySql = qs.includes('{columns}')
							? qs.replace('{columns}', msg.sqlColumns.join(', '))
							: qs + ' ' + msg.sqlColumns.join(', ');
					}
					if (msg.sqlColumnsUpdate !== undefined && displaySql.includes('{columnsUpdate}')) {
						const updateFrag = msg.sqlColumnsUpdate.map(col => col + ' = EXCLUDED.' + col).join(', ');
						displaySql = displaySql.replace('{columnsUpdate}', updateFrag);
					}
					const debugInfo = { sql: displaySql };
					if (msg.sqlData !== undefined)          debugInfo.sqlData          = msg.sqlData;
					if (msg.sqlColumns !== undefined)       debugInfo.sqlColumns       = msg.sqlColumns;
					if (msg.sqlColumnsUpdate !== undefined) debugInfo.sqlColumnsUpdate = msg.sqlColumnsUpdate;
					node.warn(debugInfo);
				}

				const doAsyncJobs = async () => {
					try {
						let q;
						if (isDynamic) {
							q = await buildQuery(sql, qs, msg.sqlData, msg.sqlColumns, msg.sqlColumnsUpdate);
						} else {
							q = await sql`${sql.unsafe(qs)}`.simple();
						}
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
