function isEmpty(value) { return (value == null || (typeof value === "string" && value.trim().length === 0)); }

module.exports = function(RED) {
	
	function ConnectionNode(n) {
		try {
			RED.nodes.createNode(this, n);

			this.name = n.name;
			this.host = n.host;
			this.unit = n.unit;
			this.apilimit = n.apilimit;
			this.tokendata = n.tokendata;
			if (this.credentials) {
				this.token = this.credentials.token;
			}
			
			if(typeof this.context().global.get('cache_' + this.host ) == 'undefined') {
				let cache = []
				this.context().global.set('cache_' + this.host, cache)
			}
		
		} catch (e) {
			node.error(e);
		}
	}
  
	RED.nodes.registerType('teamogy-config', ConnectionNode, {
		credentials: {
			token: {type: 'password'}
		}
	});
	
	function teamogyClient(data) {
		try {
			var node = this;

			RED.nodes.createNode(node,data);

			this.config = RED.nodes.getNode(data.configuration);

			let token = this.config.credentials.token
			let host = this.config.host.replace(/^https?:\/\//, '').split('/')[0];
			let unit = this.config.unit
		
			let clientid = data.id
			let c = this.context().global.get('cache_' + host)
			let st = null;

			async function sendmsg(mesg) {
				try {
					const msg = { ... mesg.msg }
					let mparams = ''
					let body = ''
					let mmerge = false
					let mlimit = 0
					let mpaging = 1000
					let moffset = 0
					
					if(data.source=='dynamic') {
						if(typeof msg.params == 'string') { mparams = msg.params }
						if(typeof msg.params == 'object') {
						 
							let pa=Object.entries(msg.params)
							if(pa.length > 0) {
								mparams = pa[0][0] + '=' + pa[0][1]

								for (let i = 1; i < pa.length; i++) {
									if(pa[i].length > 0) { mparams = mparams + '&' + pa[i][0] + '=' + pa[i][1] }
								}
							}
						}

						if(typeof msg[data.bodysource] == 'string') { body = msg[data.bodysource] }
						if(typeof msg[data.bodysource] == 'object') { body = JSON.stringify(msg[data.bodysource]) }

						if(typeof msg.merge == 'boolean') { mmerge = msg.merge }
						if(typeof msg.limit == 'number') { mlimit = msg.limit }
						if(typeof msg.paging == 'number') { mpaging = msg.paging }
						if(typeof msg.offset == 'number') { moffset = msg.offset }
	
					}
					
					if(data.source=='static') {
						const pa = data.cparams.split(/\r?\n/)
						if(pa.length > 0) {
							mparams = pa[0]
						
							for (let i = 1; i < pa.length; i++) {
								if(pa[i].length > 0) { mparams = mparams + '&' + pa[i] }
							}
						}
						body = data.cbody
						mmerge = data.merge
						mlimit = data.limit
						mpaging = data.paging
						moffset = data.offset
					}
					
					const headers = {
						'Authorization': 'Bearer ' + token,
						'Accept': 'application/json',
						'Content-type': 'application/json'
					};
					
					let url = `https://${host}/rest/v1/${unit}/`

					if(data.entity.split('_')[0] == 'v') { url = url + 'views/'}
					
					url = url + data.entity.split('_')[1].replaceAll('-','.')
					
					if(!isEmpty(mparams)) { url = url + '?' + mparams }

					const doAsyncJobs = async () => {
						try {
							
							let newMsg = JSON.parse(JSON.stringify(mesg.msg));
							
							let metadata = {};
							metadata.count = 0
							metadata.limit = 0
							let rdata = [];
							
							let method = data.method
							let offset = moffset
							
							if(method == 'GET') { body = null }
							
							if(data.entity.split('_')[0] == 'v') { 
								if(isEmpty(mparams)) { url = url + '?' } else { url = url + '&' }
								
								while (offset != null) {
									
									if(parseInt(mlimit) == 0) { mlimit = 1000000000}
									if(parseInt(mlimit) < parseInt(mpaging)) { mpaging = mlimit }

									eurl = encodeURI(url + 'limit=' + mpaging +'&offset=' + offset)

									const response = await fetch(eurl, {headers, method, body});
							
									if(response.status >= 200 && response.status < 300) {
										
										const body = await response.json();
										offset = body?.metadata?.nextOffset
										metadata.count = metadata.count + parseInt(body?.metadata?.count)
										metadata.limit = body?.metadata?.limit
										metadata.nextOffset = offset

										if(mlimit - metadata.count < mpaging) { mpaging = mlimit - metadata.count}

										if(mmerge == false) {
											newMsg.payload=body;
											newMsg.payload.count=body.data.length;
											node.send(JSON.parse(JSON.stringify(newMsg)));	
										} 
										
										if(mmerge == true) {
											for(let bd of body.data) {
												rdata.push(bd)	
											}
										} 
										
										if(mlimit <= metadata.count) { break; }
			
									} else {
										node.error('Response status: ' + response.status);
										node.error('Response status: ' + await response.text());
										break;
									}	
								} 
								
								if(mmerge == true) {
									let body = {}
									metadata.limit = parseInt(data.paging)
									body.metadata = metadata
									body.data = rdata
									body.count = rdata.length
									newMsg.payload = body
									node.send(JSON.parse(JSON.stringify(newMsg)));	
								}
							}
							
							if(data.entity.split('_')[0] == 'r') { 

								const response = await fetch(encodeURI(url), {headers, method, body});

								if(response.status >= 200 && response.status < 300) {
									const body = await response.json();
									newMsg.payload = body
									node.send(JSON.parse(JSON.stringify(newMsg)));	
								} else {
									let payload = {}
									payload.status = response.status
									payload.text = await response.text()

									newMsg.payload = payload
									node.send(JSON.parse(JSON.stringify(newMsg)));	
								}
							}
						} catch (e) {
							node.error(e);
						} 
					}
					
					const r = await doAsyncJobs()
					
				} catch (e) {
					node.error(e);
				}
			}
			
			function fa(arr,cid) {
				try {
					let na = arr.filter(function (el) {
						return el.clientid == cid
					});
					return na.length
				} catch (e) {
					node.error(e);
				} 
			}

			async function setTimer(host) {
				try {
					if(c.length > 0) {
						let nd = new Date()
						if(nd.getTime() > c[0].stime) {
							if(c[0].clientid == clientid) {
								let m = c.shift(0);
								await sendmsg(m)
							}
						}
							
						let fal = fa(c,clientid);

						if(fal == 0) {
							node.status({fill: "green", shape: "dot", text: fal + " waiting messages"});
						} else {
							node.status({fill: "yellow", shape: "dot", text: fal + " waiting messages"});
						}
					} else {
						clearInterval(st) 
						st = null
					}
				}
				catch (e) {
					node.error(e);
				}
			}

			node.on('input', async function(msg) {
				try {
					if(st == null){ st = setInterval(function () { setTimer(host) }, 1000)}

					if(msg.skip != true) {
						let stime = 0
						let nd = new Date()
						
						if(c.length > 0) {
							let hstime = c.findLast((el) => el);
							stime = hstime.stime + (60000 / this.config.apilimit) 
						} else {
							stime = nd.getTime()
						}

						let md = {}
						md.msg = msg
						md.host = host
						md.rtime = nd.getTime();
						md.stime = stime
						md.clientid = clientid
						c.push(md)
					} else {
						node.send(msg)
					}
				}
				catch (e) {
					node.error(e);
				}
			});
		
		} catch (e) {
			node.error(e);
		}
	}
	
	RED.nodes.registerType("teamogy-client",teamogyClient);
}