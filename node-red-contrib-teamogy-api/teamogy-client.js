function isEmpty(value) { return (value == null || (typeof value === "string" && value.trim().length === 0)); }

async function fetchWithRetry(url, options, retries, delay, node) {
    for (let i = 0; i <= retries; i++) {
        try {
            const response = await fetch(url, options);
            if (response.status >= 200 && response.status < 300) {
                return response;
            }

			let o = {}
			o.status = response.status;
			o.message = await response.text();
			o.attempt = i + 1;
			o.delay = delay / 1000;

			await new Promise(resolve => setTimeout(resolve, delay));

        } catch (error) {

			let o = {}
			o.status = 0;
			o.message = 'Request failed';
			o.attempt = i + 1;
			o.delay = delay / 1000;
            
			await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    return null;
}

module.exports = function(RED) {
	
	function getConfigId(name) {
        var configNodes = [];
        RED.nodes.eachNode(function(node) {
            if (node.type === "teamogy-config") {
                configNodes.push(node);
            }
        });

		const configId = configNodes.find(item => item.name === name)?.id;
		return configId;
	}

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
			let connName = this.config.name
		
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
					let entity = '' 
					let method = 'GET'
					let delay = 0;
					let repeat = 5;
					let rdelay = 30;

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
						if(typeof msg.unit == 'number') { unit = msg.unit } 
						if(typeof msg.entity == 'string') { entity = msg.entity } else { entity = data.entity }
						if(typeof msg.method == 'string') { method = msg.method } else { method = data.method }
						if(typeof msg.delay == 'number') { delay = msg.delay * 1000 } else { delay = data.delay * 1000 }
						if(typeof msg.repeat == 'number') { repeat = msg.repeat ?? 5 } else { repeat = data.repeat ?? 5 }
						if(typeof msg.rdelay == 'number') { rdelay = msg.rdelay * 1000 } else { rdelay = data.rdelay * 1000 }
	
						if(typeof msg.connection == 'string') {
							if(msg.connection) {
								const customConfig = RED.nodes.getNode(getConfigId(msg.connection));
								if(customConfig) {
									token = customConfig.credentials.token;
									host = customConfig.host.replace(/^https?:\/\//, '').split('/')[0];
									unit = customConfig.unit;
								} else {
									node.warn("Specified connection not found: " + msg.connection + ", using default: " + connName);
								}
							}
						}
					
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
						entity = data.entity
						method = data.method
						delay = data.delay * 1000
						repeat = data.repeat ?? 5
						rdelay = data.rdelay * 1000
					}

					const headers = {
						'Authorization': 'Bearer ' + token,
						'Accept': 'application/json',
						'Content-type': 'application/json'
					};

					let url = `https://${host}/rest/v1/${unit}/`

					if(entity.split('_')[0] == 'v') { url = url + 'views/'}
					
					url = url + entity.split('_')[1].replaceAll('-','.')
					
					if(!isEmpty(mparams)) { url = url + '?' + mparams }
					
					const doAsyncJobs = async () => {
						try {
							
							let metadata = {};
							metadata.count = 0
							metadata.limit = 0
							let rdata = [];

							let offset = moffset

							if(method == 'GET') { body = null }
							
							if(entity.split('_')[0] == 'v') { 
								if(isEmpty(mparams)) { url = url + '?' } else { url = url + '&' }
								
								const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
								
								while (offset != null) {
									
									if(parseInt(mlimit) == 0) { mlimit = 1000000000}
									if(parseInt(mlimit) < parseInt(mpaging)) { mpaging = mlimit }

									eurl = encodeURI(url + 'limit=' + mpaging +'&offset=' + offset)

                                    const response = await fetchWithRetry(eurl, { headers, method, body }, repeat, rdelay, node);
							
									if(response && response.status >= 200 && response.status < 300) {
										
										const body = await response.json();
										offset = body?.metadata?.nextOffset
										metadata.count = metadata.count + parseInt(body?.metadata?.count)
										metadata.limit = body?.metadata?.limit
										metadata.nextOffset = offset

										if(mlimit - metadata.count < mpaging) { mpaging = mlimit - metadata.count}

										if(mmerge == false) {
											msg.payload = body;
											msg.count = body.data.length;
											node.send(msg);	
										} 
										
										if(mmerge == true) {
											for(let bd of body.data) {
												rdata.push(bd)	
											}
										} 
										
										if(mlimit <= metadata.count) { break; }
										if (offset != null && delay > 0) { await sleep(delay); }
										
									} else {
                                        if (!response) {
                                            node.error('Request failed after all attempts.');
											msg.error = 'Request failed after all attempts.'
											msg.payload = null;
											if(msg.res){
												msg.payload = JSON.stringify('Request failed after all attempts.');
												msg.statusCode = 500;
											}
											node.send(msg);
                                        } else {
                                            node.error('Response status: ' + response.status);
                                            node.error('Response text: ' + await response.text());
                                        }
										break;
									}	
								} 
								
								if(mmerge == true) {
									let body = {}
									metadata.limit = parseInt(data.paging)
									body.metadata = metadata
									body.data = rdata
									msg.payload = body
									msg.count = rdata.length
									node.send(msg);	
								}
							}
							
							if(entity.split('_')[0] == 'r') { 

                                const response = await fetchWithRetry(encodeURI(url), { headers, method, body }, repeat, rdelay, node);

								if(response && response.status >= 200 && response.status < 300) {
									const body = await response.json();
									msg.payload = body
									node.send(msg);	
								} else {
									if (!response) {
										node.error('Request failed after all attempts.');
                                        msg.error = 'Request failed after all attempts.'
										msg.payload = null;
										if(msg.res){
											msg.payload = JSON.stringify('Request failed after all attempts.');
											msg.statusCode = 500;
										}
										node.send(msg);
                                    } else {
										node.error('Response status: ' + response.status);
                                        node.error('Response text: ' + await response.text());
                                    }
								}
							}
						} catch (e) {
							node.error(e);
						} 
					}
					
					await doAsyncJobs();
					
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
