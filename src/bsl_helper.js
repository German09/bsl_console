
/**
 * Class for provideSignatureHelp
 */
class SignatureHelpResult {

	constructor(helper) {
		this.value = helper;
	}

	dispose() {
	}

}

/**
 * Main helper for BSL
 */
class bslHelper {

	constructor(model, position) {

		this.model = model;
		this.lineNumber = position.lineNumber;
		this.column = position.column;

		let wordData = model.getWordAtPosition(position);
		this.word = wordData ? wordData.word.toLowerCase() : '';

		this.lastOperator = '';
		this.hasWhitespace = false;

		this.textBeforePosition = this.getTextBeforePosition();
		this.lastExpression = this.getLastExpression();
		this.lastRawExpression = this.getLastRawExpression();		

	}

	/**
	 * Check if string has russian characters
	 * @param {string} text string for analisis
	 */
	hasRu(text) {

		return /[\u0410-\u044F]+/.test(text);

	}

	/**
	 * Find first string which has no pair braces
	 * @param {string} str string for analisis
	 * 
	 * @return {object} unclosed string
	 */
	unclosedString(str) {

		let index = str.length - 1;
		let flag = 0;
		let character = '';
		let unclosed = '';

		while (0 <= index) {
			character = str[index];
			unclosed = character + unclosed;
			if (character == ')')
				flag++;
			if (character == '(') {
				if (flag == 0)
					return { string: unclosed, index: index };
				else
					flag--;
			}
			index--;
		}

		return { string: '', index: -1 };

	}

	/**
	 * Gets whole text beetween first and current position
	 * 
	 * @returns {string} text
	 */
	getFullTextBeforePosition() {

		return this.model.getValueInRange({ startLineNumber: 1, startColumn: 1, endLineNumber: this.lineNumber, endColumn: this.column }).trim().toLowerCase();

	}

	/**
	 * Gets current line`s text until cursor position
	 * 
	 * @returns {string} text
	 */
	getTextBeforePosition() {

		let text = this.model.getValueInRange({ startLineNumber: this.lineNumber, startColumn: 1, endLineNumber: this.lineNumber, endColumn: this.column });
		this.hasWhitespace = (text.substr(-1) == ' ');
		return text.trim().toLowerCase();

	}

	/**
	 * Returns array which contain operators and expressions from textBeforePosition
	 * Example, "ТаблицаЗначений.Найти(Справочники.Номенклатура.НайтиПоКоду("
	 * 	[0] => ТаблицаЗначений
	 * 	[1] => .
	 * 	[2] => Найти	 
	 * 	[3] => (
	 * 	[4] => Справочники
	 * 	[5] => .
	 * 	[6] => Номенклатура
	 * 	[7] => .
	 * 	[8] => НайтиПоКоду
	 * 	[9] => (
	 * * @returns {array} array with expressions
	 */
	getRawExpressioArray() {

		return this.textBeforePosition.replace(/([\(\[\+\-\=\<\>\%\/\.\,;:"])/g, ' $1 ').split(' ');

	}

	/**
	 * Returns last expression (not operator and braces) from textBeforePosition
	 * Example, "ТаблицаЗначений.Найти(Справочники.Номенклатура.НайтиПоКоду("
	 * 	-> НайтиПоКоду
	 * @returns {string} last expression 
	 */
	getLastRawExpression() {

		let exp = '';
		let expArray = this.getRawExpressioArray();
		this.lastOperator = '';
		let index = expArray.length - 1;

		while (!exp && 0 <= index) {
			if (/^[^\(\)\[\]=\+\*/%<>"\.\,;:][a-zA-Z\u0410-\u044F_\.]*$/.test(expArray[index]))
				exp = expArray[index]
			else {
				if (expArray[index].trim() !== '' && !this.lastOperator)
					this.lastOperator = expArray[index];
			}
			index--;
		}

		return exp;

	}

	/**
	 * Returns last expression from textBeforePosition
	 * but except text in last unclosed braces
	 * Example, "ТаблицаЗначений.Найти(Справочники.Номенклатура.НайтиПоКоду("
	 * 	[0] => ТаблицаЗначений.Найти	 
	 * 	[1] => (
	 * 	[2] => Справочники.Номенклатура.НайтиПоКоду
	 * 	[3] => (
	 * * @returns {array} array with expressions
	 */
	getExpressioArray() {

		let text = this.textBeforePosition;
		let unclosed = this.unclosedString(text);
		if (0 <= unclosed.index) {
			text = text.substr(0, unclosed.index);
			unclosed = unclosed.string;
		}
		else {
			unclosed = '';
		}
		let array1 = text.replace(/([\(\[\+\-\=\<\>\%\/])/g, ' $1 ').split(' ');
		return unclosed ? array1.concat(unclosed) : array1;

	}

	/**
	 * Returns last expression from textBeforePosition
	 * Example, "ТаблицаЗначений.Найти(Справочники.Номенклатура.НайтиПоКоду("
	 * 	-> Справочники.Номенклатура.НайтиПоКоду
	 * @returns {string} last expression 
	 */
	getLastExpression() {

		let exp = '';
		let expArray = this.getExpressioArray();
		let index = expArray.length - 1;

		while (!exp && 0 <= index) {
			if (/^(?!новый |new )[^\(\)\[\]=\+\*/%<>"][a-zA-Z\u0410-\u044F_\.]*$/.test(expArray[index])) {
				exp = expArray[index]
			}
			index--;
		}

		return exp;

	}

	/**
	 * Returns last expression from getExpressioArray - nstep
	 * @param {int} nstep - quantity of steps
	 */
	getLastNExpression(nstep) {

		let expArray = this.getRawExpressioArray();
		return (nstep < expArray.length) ? expArray[expArray.length - 1 - nstep] : '';

	}

	/**
	 * Determines if string contain class constructor (New|Новый)
	 * @param {string} word - last typed word
	 */
	requireClass(word) {

		let exp = this.getLastNExpression(1);
		return /^(?:new|новый)$/.test(exp);

	}

	/**
	 * Retuns function name from last expression
	 * 
	 * @returns {string} - name of function or empty string
	 */
	getFuncName() {

		let regex = /(.+?)(?:\((.*))?$/.exec(this.lastExpression);
		return regex && 1 < regex.length ? regex[1] : '';

	}

	/**
	 * Fills array of completition for language keywords, classes, global functions,
	 * global variables and system enumarations
	 * 
	 * @param {array} suggestions array of suggestions for provideCompletionItems
	 * @param {object} data objects from BSL-JSON dictionary
	 * @param {CompletionItemKind} kind - monaco.languages.CompletionItemKind (class, function, constructor etc.)
	 */
	getCommonCompletition(suggestions, data, kind, allowAtStart) {

		let word = this.word;
		let emptyString = (this.textBeforePosition.slice(0, -1).trim() === '');		

		if (word && (allowAtStart || !emptyString)) {

			for (const [key, value] of Object.entries(data)) {
				let values = [];
				if (value.hasOwnProperty('name')) {

					let postfix = '';
					let signatures = [];

					if (kind == monaco.languages.CompletionItemKind.Constructor) {
						signatures = this.getConstructSignature(value);
						if (signatures.length == 0 || (signatures.length == 1 && signatures[0].parameters.length == 0))
							postfix = '()';
					}
					else if (kind == monaco.languages.CompletionItemKind.Function) {
						signatures = this.getMethodsSignature(value);
						if (signatures.length == 0 || (signatures.length == 1 && signatures[0].parameters.length == 0))
							postfix = '()';
					}

					values.push({ name: value.name, detail: value.description, description: value.hasOwnProperty('returns') ? value.returns : '', postfix: postfix });
					values.push({ name: value.name_en, detail: value.description, description: value.hasOwnProperty('returns') ? value.returns : '', postfix: postfix });

				}
				else {

					for (const [inkey, invalue] of Object.entries(value)) {
						let postfix = '';
						if (invalue.hasOwnProperty('postfix'))
							postfix = invalue.postfix;
						values.push({ name: inkey, detail: '', description: '', postfix: postfix });
					}

				}

				values.forEach(function (value) {
					if (value.name.toLowerCase().startsWith(word)) {
						suggestions.push({
							label: value.name,
							kind: kind,
							insertText: value.name + value.postfix,
							insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
							detail: value.detail,
							documentation: value.description
						});
					}
				})
			}
		}

	}

	/**
	 * Fills array of completition for class methods, properties and
	 * system enumarations
	 * 
	 * @param {array} suggestions array of suggestions for provideCompletionItems
	 * @param {object} data objects from BSL-JSON dictionary
	 * @param {string} className name of class
	 */
	getClassCompletitionByName(suggestions, data, className) {

		let classExists = false;

		if (className) {

			for (const [key, value] of Object.entries(data)) {

				if (value.name.toLowerCase() == className || value.name_en.toLowerCase() == className) {

					classExists = true;
					let values = [];

					if (value.hasOwnProperty('methods')) {

						for (const [mkey, mvalue] of Object.entries(value.methods)) {

							let description = mvalue.hasOwnProperty('returns') ? mvalue.returns : '';
							let signatures = this.getMethodsSignature(mvalue);
							let postfix = '';
							if (signatures.length == 0 || (signatures.length == 1 && signatures[0].parameters.length == 0))
								postfix = '()';

							if (this.hasRu(className)) {
								values.push({
									name: mvalue.name,
									postfix: postfix,
									detail: mvalue.description,
									description: description,
									kind: monaco.languages.CompletionItemKind.Method,
									insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
								});
							}
							else {
								values.push({
									name: mvalue.name_en,
									postfix: postfix,
									detail: mvalue.description,
									description: description,
									kind: monaco.languages.CompletionItemKind.Method
								});
							}

						}

					}

					if (value.hasOwnProperty('properties')) {

						for (const [pkey, pvalue] of Object.entries(value.properties)) {

							if (this.hasRu(className)) {
								values.push({
									name: pvalue.name,
									detail: pvalue.description,
									description: '',
									postfix: '',
									kind: monaco.languages.CompletionItemKind.Field
								});
							}
							else {
								values.push({
									name: pvalue.name_en,
									detail: pvalue.description,
									description: '',
									postfix: '',
									kind: monaco.languages.CompletionItemKind.Field
								});
							}

						}

					}

					if (value.hasOwnProperty('values')) {

						for (const [vkey, vvalue] of Object.entries(value.values)) {

							if (this.hasRu(className)) {
								values.push({
									name: vvalue.name,
									detail: vvalue.description,
									description: '',
									postfix: '',
									kind: monaco.languages.CompletionItemKind.Field
								});
							}
							else {
								values.push({
									name: vvalue.name_en,
									detail: vvalue.description,
									description: '',
									postfix: '',
									kind: monaco.languages.CompletionItemKind.Field
								});
							}

						}

					}

					values.forEach(function (value) {

						suggestions.push({
							label: value.name,
							kind: value.kind,
							insertText: value.name + value.postfix,
							insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
							detail: value.detail,
							documentation: value.description
						});

					});

				}

			}

		}

		return classExists;

	}

	/**
	 * Fills array of completition for class methods, properties and
	 * system enumarations
	 * 
	 * @param {array} suggestions array of suggestions for provideCompletionItems
	 * @param {object} data objects from BSL-JSON dictionary
	 */
	getClassCompletition(suggestions, data) {

		let className = this.getLastRawExpression();
		let classExists = this.getClassCompletitionByName(suggestions, data, className);

		if (!classExists) {
			let unclosed = this.unclosedString(this.textBeforePosition);
			let regex = null;
			if (unclosed.string)
				regex = /(.+?)(?:\.(.*?))?\.?(?:\.(.*?))?\(?$/.exec(unclosed.string.slice(1));
			else
				regex = /(.+?)(?:\.(.*?))?\.?(?:\.(.*?))?\(?$/.exec(this.lastExpression);
			className = regex && 1 < regex.length ? regex[1] : '';
			if (!this.lastOperator && !this.hasWhitespace)
				classExists = this.getClassCompletitionByName(suggestions, data, className);
		}

		return classExists;

	}

	/**
	 * Fills array of completition for metadata subitem	like catalog of products
	 * 
	 * @param {array} suggestions array of suggestions for provideCompletionItems
	 * @param {object} data objects from BSL-JSON dictionary	 
	 */
	getMetadataItemCompletition(suggestions, data) {

		let itemExists = false;

		let exp = this.getLastRawExpression();
		let fullText = this.getFullTextBeforePosition();
		let regex = new RegExp(exp + '\\s?=\\s?(.*)\\(.*\\);', 'gi');
		regex = regex.exec(fullText);
		if (regex && 1 < regex.length) {

			regex = /(.+?)(?:\.(.*?))?\.?(?:\.(.*?))?\(?$/.exec(regex[1]);

			let metadataName = regex && 1 < regex.length ? regex[1] : '';
			let metadataItem = regex && 2 < regex.length ? regex[2] : '';
			let metadataFunc = regex && 3 < regex.length ? regex[3] : '';

			if (metadataName && metadataItem && metadataFunc) {

				for (const [key, value] of Object.entries(data)) {

					if (value.name.toLowerCase() == metadataName || value.name_en.toLowerCase() == metadataName) {

						for (const [ikey, ivalue] of Object.entries(value.items)) {

							if (ikey.toLowerCase() == metadataItem) {

								itemExists = true;

								for (const [pkey, pvalue] of Object.entries(ivalue.properties)) {
									suggestions.push({
										label: pkey,
										kind: monaco.languages.CompletionItemKind.Field,
										insertText: pkey,
										insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
										detail: pvalue
									});
								}

								if (value.hasOwnProperty('objMethods')) {

									let postfix = '';
									let signatures = [];

									for (const [mkey, mvalue] of Object.entries(value.objMethods)) {

										signatures = this.getMethodsSignature(mvalue);
										if (signatures.length == 0 || (signatures.length == 1 && signatures[0].parameters.length == 0))
											postfix = '()';

										if (this.hasRu(metadataName)) {
											suggestions.push({
												label: mvalue.name,
												kind: monaco.languages.CompletionItemKind.Function,
												insertText: mvalue.name + postfix,
												insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
												detail: mvalue.description
											});
										}
										else {
											suggestions.push({
												label: mvalue.name_en,
												kind: monaco.languages.CompletionItemKind.Function,
												insertText: mvalue.name + postfix,
												insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
												detail: mvalue.description
											});
										}

									}
									
								}

							}

						}

					}

				}

			}
		}

		return itemExists;

	}

	/**
	 * Fills array of completition for metadata item like Catalogs,
	 * Documents, InformationRegisters, etc.
	 * 
	 * @param {array} suggestions array of suggestions for provideCompletionItems
	 * @param {object} data objects from BSL-JSON dictionary
	 */
	getMetadataCompletition(suggestions, data) {

		let metadataExists = false;

		let unclosed = this.unclosedString(this.textBeforePosition);

		let regex = null;

		if (unclosed.string)
			regex = /(.+?)(?:\.(.*?))?\.?(?:\.(.*?))?\(?$/.exec(unclosed.string.slice(1));
		else
			regex = /(.+?)(?:\.(.*?))?\.?(?:\.(.*?))?\(?$/.exec(this.lastExpression);
		let metadataName = regex && 1 < regex.length ? regex[1] : '';
		let metadataItem = regex && 2 < regex.length ? regex[2] : '';
		let metadataFunc = regex && 3 < regex.length ? regex[3] : '';
		
		if (metadataName && !metadataFunc) {

			for (const [key, value] of Object.entries(data)) {

				if (value.name.toLowerCase() == metadataName || value.name_en.toLowerCase() == metadataName) {

					metadataExists = true;
					let values = [];
					let itemNode = null;

					if (metadataName) {

						for (const [ikey, ivalue] of Object.entries(value.items)) {

							if (ikey.toLowerCase() == metadataItem) {
								itemNode = ivalue;
								break;
							}

						}

					}

					if (itemNode) {

						if (itemNode.hasOwnProperty('predefined')) {

							for (const [pkey, pvalue] of Object.entries(itemNode.predefined)) {
														
								values.push({
									name: pkey,
									postfix: '',
									detail: '',
									description: '',
									kind: monaco.languages.CompletionItemKind.Field,
									insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
								});
																								
							}

						}

						if (value.hasOwnProperty('methods')) {

							for (const [mkey, mvalue] of Object.entries(value.methods)) {

								let description = mvalue.hasOwnProperty('returns') ? mvalue.returns : '';
								let signatures = this.getMethodsSignature(mvalue);
								let postfix = '';
								if (signatures.length == 0 || (signatures.length == 1 && signatures[0].parameters.length == 0))
									postfix = '()';

								if (this.hasRu(metadataName)) {
									values.push({
										name: mvalue.name,
										postfix: postfix,
										detail: mvalue.description,
										description: description,
										kind: monaco.languages.CompletionItemKind.Method,
										insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
									});
								}
								else {
									values.push({
										name: mvalue.name_en,
										postfix: postfix,
										detail: mvalue.description,
										description: description,
										kind: monaco.languages.CompletionItemKind.Method
									});
								}

							}

						}
						
						if (key == 'enums') {

							for (const [pkey, pvalue] of Object.entries(itemNode.properties)) {
								suggestions.push({
									label: pkey,
									kind: monaco.languages.CompletionItemKind.Field,
									insertText: pkey,
									insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
									detail: pvalue
								});
							}

						}

					} else {

						for (const [ikey, ivalue] of Object.entries(value.items)) {
							values.push({
								name: ikey,
								detail: '',
								description: '',
								postfix: '',
								kind: monaco.languages.CompletionItemKind.Field
							});
						}

					}

					values.forEach(function (value) {

						suggestions.push({
							label: value.name,
							kind: value.kind,
							insertText: value.name + value.postfix,
							insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
							detail: value.detail,
							documentation: value.description
						});

					});

				}

			}

		}

		if (!metadataExists)
			metadataExists = this.getMetadataItemCompletition(suggestions, data);

		return metadataExists;

	}

	/**
	 * Completition provider
	 * 
	 * @returns {array} array of completition
	 */
	getCompletition() {

		let suggestions = [];

		if (!this.getClassCompletition(suggestions, bslGlobals.classes)) {

			if (!this.getClassCompletition(suggestions, bslGlobals.systemEnum)) {

				if (!this.getMetadataCompletition(suggestions, bslMetadata)) {

					this.getCommonCompletition(suggestions, bslGlobals.keywords, monaco.languages.CompletionItemKind.Keyword.ru, true);
					this.getCommonCompletition(suggestions, bslGlobals.keywords, monaco.languages.CompletionItemKind.Keyword.en, true);

					if (this.requireClass()) {
						this.getCommonCompletition(suggestions, bslGlobals.classes, monaco.languages.CompletionItemKind.Constructor, false);
					}
					else {
						this.getCommonCompletition(suggestions, bslGlobals.globalfunctions, monaco.languages.CompletionItemKind.Function, true);
						this.getCommonCompletition(suggestions, bslGlobals.globalvariables, monaco.languages.CompletionItemKind.Class, false);
						this.getCommonCompletition(suggestions, bslGlobals.systemEnum, monaco.languages.CompletionItemKind.Enum, false);
					}

					this.getSnippets(suggestions, snippets);

				}

			}

		}

		if (suggestions.length)
			return { suggestions: suggestions }
		else
			return [];

	}

	/**
	 * Returns array of parametrs as described in JSON-dictionary
	 * for current node (method)
	 *  
	 * @param {object} method - node from BSL-JSON dictionary
	 * 
	 * @returns {array} array of method`s parameters
	 */
	getMethodsSignature(method) {

		let signatures = [];

		if (method.hasOwnProperty('signature')) {

			for (const [skey, svalue] of Object.entries(method.signature)) {

				if (svalue.hasOwnProperty('СтрокаПараметров') && svalue.hasOwnProperty('Параметры')) {

					let signature = {
						label: svalue.СтрокаПараметров,
						parameters: []
					}

					for (const [pkey, pvalue] of Object.entries(svalue.Параметры)) {
						signature.parameters.push({
							label: pkey,
							documentation: pvalue
						});
					}

					signatures.push(signature);

				}

			}

		}

		return signatures;

	}

	/**
	 * Returns array of signatures as described in JSON-dictionary
	 * for current node (class)
	 *  
	 * @param {object} elem - node from BSL-JSON dictionary
	 * 
	 * @returns {array} array of signatures
	 */
	getConstructSignature(elem) {

		let signatures = [];

		if (elem.hasOwnProperty('constructors')) {

			for (const [ckey, cvalue] of Object.entries(elem.constructors)) {

				if (cvalue.hasOwnProperty('signature')) {

					let signature = {
						label: cvalue.signature,
						documentation: cvalue.hasOwnProperty('description') ? cvalue.description : '',
						parameters: []
					}

					if (cvalue.hasOwnProperty('params')) {

						for (const [pkey, pvalue] of Object.entries(cvalue.params)) {
							signature.parameters.push({
								label: pkey,
								documentation: pvalue
							});
						}

					}

					signatures.push(signature);

				}

			}

		}

		return signatures;

	}

	/**
	 * Finds signatures provided for current class
	 * 
	 * @param {object} data objects from BSL-JSON dictionary
	 * 
	 * @returns {object} helper with signatures
	 */
	getClassSigHelp(data) {

		let helper = null;

		let regex = /(.+?)(?:\.(.*))?$/.exec(this.lastExpression);
		let className = regex && 1 < regex.length ? regex[1] : '';
		let methodName = regex && 2 < regex.length ? regex[2] : '';

		if (className) {

			for (const [key, value] of Object.entries(data)) {

				if (value.name.toLowerCase() == className || value.name_en.toLowerCase() == className) {

					let signatures = [];

					if (methodName && value.hasOwnProperty('methods')) {

						for (const [mkey, mvalue] of Object.entries(value.methods)) {

							if (mvalue.name.toLowerCase() == methodName || mvalue.name_en.toLowerCase() == methodName) {
								signatures = signatures.concat(this.getMethodsSignature(mvalue));
							}

						}

					}

					signatures = signatures.concat(this.getConstructSignature(value));

					if (signatures.length) {
						helper = {
							activeParameter: this.textBeforePosition.split(',').length - 1,
							activeSignature: 0,
							signatures: signatures,
						}
					}

				}

			}

		}

		return helper;

	}

	/**
	 * Finds signatures provided for metadata subitem`s methods
	 * like Write, Unlock
	 * 
	 * @param {object} data objects from BSL-JSON dictionary
	 * 
	 * @returns {object} helper with signatures
	 */
	getMetadataItemSigHelp(data) {

		let helper = null;

		let exp = this.getLastNExpression(4);
		let fullText = this.getFullTextBeforePosition();
		let regex = new RegExp(exp + '\\s?=\\s?(.*)\\(.*\\);', 'gi');
		regex = regex.exec(fullText);

		if (regex && 1 < regex.length) {

			regex = /(.+?)(?:\.(.*?))?\.?(?:\.(.*?))?\(?$/.exec(regex[1]);

			let metadataName = regex && 1 < regex.length ? regex[1] : '';
			let metadataItem = regex && 2 < regex.length ? regex[2] : '';
			let metadataFunc = regex && 3 < regex.length ? regex[3] : '';

			if (metadataName && metadataItem && metadataFunc) {

				metadataFunc = this.lastRawExpression;

				if (metadataFunc) {

					for (const [key, value] of Object.entries(data)) {

						if (value.name.toLowerCase() == metadataName || value.name_en.toLowerCase() == metadataName) {

							for (const [ikey, ivalue] of Object.entries(value.items)) {

								if (ikey.toLowerCase() == metadataItem) {

									if (value.hasOwnProperty('objMethods')) {

										for (const [mkey, mvalue] of Object.entries(value.objMethods)) {

											if (mvalue.name.toLowerCase() == metadataFunc || mvalue.name_en.toLowerCase() == metadataFunc) {

												let signatures = this.getMethodsSignature(mvalue);
												if (signatures.length) {
													helper = {
														activeParameter: this.textBeforePosition.split(',').length - 1,
														activeSignature: 0,
														signatures: signatures,
													}
												}

											}

										}

									}

								}

							}

						}

					}

				}

			}

		}

		return helper;

	}

	/**
	 * Finds signatures provided for metadata item`s methods
	 * like FindByCode, CreateRecordManager
	 * 
	 * @param {object} data objects from BSL-JSON dictionary
	 * 
	 * @returns {object} helper with signatures
	 */
	getMetadataSigHelp(data) {

		let helper = null;

		let regex = /(.+?)(?:\.(.*?))?\.?(?:\.(.*?))?\(?$/.exec(this.lastExpression);
		let metadataName = regex && 1 < regex.length ? regex[1] : '';
		let metadataItem = regex && 2 < regex.length ? regex[2] : '';
		let metadataFunc = regex && 3 < regex.length ? regex[3] : '';

		if (metadataFunc) {

			for (const [key, value] of Object.entries(data)) {

				if (value.name.toLowerCase() == metadataName || value.name_en.toLowerCase() == metadataName) {

					if (value.hasOwnProperty('methods')) {

						for (const [mkey, mvalue] of Object.entries(value.methods)) {

							if (mvalue.name.toLowerCase() == metadataFunc || mvalue.name_en.toLowerCase() == metadataFunc) {
								let signatures = this.getMethodsSignature(mvalue);
								if (signatures.length) {
									helper = {
										activeParameter: this.textBeforePosition.split(',').length - 1,
										activeSignature: 0,
										signatures: signatures,
									}
								}
							}

						}

					}

				}

			}

		}
		else {
			helper = this.getMetadataItemSigHelp(data);
		}

		return helper;

	}

	/**
	 * Finds signatures provided for global functions	 
	 * 
	 * @param {object} data objects from BSL-JSON dictionary
	 * 
	 * @returns {object} helper with signatures
	 */
	getCommonSigHelp(data) {

		let helper = null;

		let funcName = this.getFuncName();

		if (funcName) {

			for (const [key, value] of Object.entries(data)) {

				if (value.name.toLowerCase() == funcName || value.name_en.toLowerCase() == funcName) {

					let signatures = this.getMethodsSignature(value);

					if (signatures.length) {
						helper = {
							activeParameter: this.textBeforePosition.split(',').length - 1,
							activeSignature: 0,
							signatures: signatures,
						}
					}

				}

			}

		}

		return helper;

	}

	/**
	 * Fills array of completition for snippets	 
	 * 
	 * @param {array} suggestions array of suggestions for provideCompletionItems
	 * @param {object} data objects from BSL-JSON dictionary
	 */
	getSnippets(suggestions, data) {

		if (this.word) {

			for (const [key, value] of Object.entries(data)) {

				if (key.toLowerCase().startsWith(this.word)) {

					suggestions.push({
						label: value.prefix,
						kind: monaco.languages.CompletionItemKind.Snippet,
						insertText: value.body,
						insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
						detail: key,
						documentation: value.body
					});

				}

			}

		}

	}

	/**
	 * Signature help provider
	 * 
	 * @returns {object} helper
	 */
	getSigHelp() {

		let helper = this.getMetadataSigHelp(bslMetadata);

		if (!helper)
			helper = this.getClassSigHelp(bslGlobals.classes);

		if (!helper)
			helper = this.getCommonSigHelp(bslGlobals.globalfunctions);

		if (helper)
			return new SignatureHelpResult(helper);

	}

	/**
	 * Updates bslMetadata from JSON-string which
	 * was received from 1C
	 * 
	 * @param {string} metadata JSON-string with metadata info
	 * 
	 * @returns {true|object} true - metadata was updated, {errorDescription} - not
	 */
	static updateMetadata(metadata) {

		try {
			let metadataObj = JSON.parse(metadata);
			if (metadataObj.hasOwnProperty('catalogs')) {
				for (const [key, value] of Object.entries(metadataObj)) {
					bslMetadata[key].items = value;
				}
				return true;
			}
			else {
				throw new TypeError("Wrong structure of metadata");
			}

		}
		catch (e) {
			return { errorDescription: e.message };
		}


	}

	/**
	 * Finds blocks like conditions (if...endif) and loops (while...enddo)
	 * when start column startString equal start column endString
	 * 
	 * @param {ITextModel} current model of editor
	 * @param {string} regexp to detect opening construction 
	 * @param {string} regexp to detect closing construction 
	 * 
	 * @returns {array} - array of folding ranges
	 */
	static getRangesForConstruction(model, startString, endString) {
		
		let ranges = [];
		
		const startMatches = model.findMatches("(?:^|\\b)?(" + startString + ") ", false, true)	
		let startMatch = null;

		const endMatches =  model.findMatches("(?:^|\\b)?(" + endString + ") ?;", false, true)	
		let endMatch = null;
		
		let structFound = false;
		let subidx = 0;

		if (startMatches && endMatches) {
			
			for (let idx = 0; idx < startMatches.length; idx++) {

				structFound = false;
				startMatch = startMatches[idx];				
										
				subidx = 0;

				while (!structFound && subidx < endMatches.length) {
					
					endMatch = endMatches[subidx];

					if (endMatch.range.startColumn == startMatch.range.startColumn && startMatch.range.startLineNumber < endMatch.range.startLineNumber) {
						structFound = true;
						ranges.push(
							{
								kind: monaco.languages.FoldingRangeKind.Region,
								start: startMatch.range.startLineNumber,
								end: endMatch.range.startLineNumber
							}
						)
					}

					subidx++;
				}				

			}

		}

		return ranges;

	}	

	/**
	 * Finds blocks like functions by regexp	 
	 * 
	 * @param {ITextModel} current model of editor
	 * @param {string} regexp to detect block 	 
	 * 
	 * @returns {array} - array of folding ranges
	 */
	static getRangesForRegexp(model, regexp) {

		let ranges = [];
		let match = null;
		const matches = model.findMatches(regexp, false, true, false, null, true)
    	
    	if (matches) {
			
      		for (let idx = 0; idx < matches.length; idx++) {
				match = matches[idx];
				ranges.push(
					{
						kind: monaco.languages.FoldingRangeKind.Region,
						start: match.range.startLineNumber,
						end: match.range.endLineNumber
					}
				)
      		}

		}

		return ranges;
	
	}

	/**
	 * Provider for folding blocks
	 * @param {ITextModel} current model of editor
	 * 
	 * @returns {array} - array of folding ranges 
	 */
	static getFoldingRanges(model) {
		
		let ranges = this.getRangesForRegexp(model, "\"(?:\\n|\\r|\\|)*(?:выбрать|select)(?:(?:.|\\n|\\r)*?)?\"");
		ranges = ranges.concat(this.getRangesForRegexp(model, "(?:^|\\b)(?:функция|процедура).*\\((?:.|\\n|\\r)*?(?:конецпроцедуры|конецфункции)"));
		ranges = ranges.concat(this.getRangesForRegexp(model, "(?:^|\\b)#.+(?:.|\\n|\\r)*?#.+$"));
		ranges = ranges.concat(this.getRangesForConstruction(model, "пока|while", "конеццикла|enddo"));
		ranges = ranges.concat(this.getRangesForConstruction(model, "для .*(?:по|из) .*|for .* (?:to|each) .*", "конеццикла|enddo"));
		ranges = ranges.concat(this.getRangesForConstruction(model, "если|if", "конецесли|endif"));
		
		return ranges;

	}

	/**
	 * Provider for hover popoup
	 * 
	 * @returns {object} - hover object or null
	 */
	getHover() {

		for (const [key, value] of Object.entries(bslGlobals)) {

			for (const [ikey, ivalue] of Object.entries(value)) {
	
				if (ivalue.hasOwnProperty('name')) {
	
					if (ivalue.name.toLowerCase() == this.word) {

						let contents = [
							{ value: '**' + ivalue.name + '**' },
							{ value: ivalue.description }
						]
		
						if (ivalue.hasOwnProperty('returns')) {
							contents.push(
								{ value: 'Возвращает: ' + ivalue.returns }
							)
						}
						
						return {
							range: new monaco.Range(this.lineNumber, this.column, this.lineNumber, this.model.getLineMaxColumn(this.lineNumber)),
							contents: contents
						};
					}
	
				}
				
			}
	
		}		

		return null;

	}

	/**
	 * Returns query's text from current position
	 * 
	 * @returns {object} object with text and range or null
	 */
	getQuery() {
	
		const matches = this.model.findMatches("\"(?:\\n|\\r|\\|)*(?:выбрать|select)(?:(?:.|\\n|\\r)*?)?\"", false, true, false, null, true)		
	
		let idx = 0;
		let match = null;
		let queryFound = false;
	
		if (matches) {
	
		  while (idx < matches.length && !queryFound) {
			match = matches[idx];
			queryFound = (match.range.startLineNumber <= this.lineNumber && this.lineNumber <= match.range.endLineNumber);
			idx++;
		  }
	
		}
	
		return queryFound ? { text: match.matches[0], range: match.range } : null;
	
	  }

}