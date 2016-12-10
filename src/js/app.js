/**
 * Welcome to Habitica Tasks
 *
 *
 */

var Vibe = require('ui/vibe');

var UI = require('ui');
var Settings = require('settings');
var ajax = require('ajax');
var Feature = require('platform/feature');

// habitica API constants
var habiticaBaseUrl = 'https://habitica.com/api/v3';
var habiticaStatus = '/status'; //Returns the status of the server (up or down). Does not require authentication.
var habiticaGetTasksUser = '/tasks/user';
//var habiticaGetUserAnonymized = '/user/anonymized';
var habiticaGetUser = '/user';
var habiticaPostTasksScore = '/tasks/:taskId/score/:direction';
var habiticaPostTasksChecklistScore = '/tasks/:taskId/checklist/:itemId/score';
var habiticaPostSkillCast = '/user/class/cast/:spellId';

var menu, timeout;

// Set a configurable
Settings.config(
  { url: 'https://kdemerath.github.io/settings.html' },
  function(e) {
    //console.log('opening configurable');
  },
  function(e) {
    //console.log('closed configurable');
    // Show the raw response if parsing failed
    if (e.failed) {
      console.log(e.response);
    } else {
      var options = Settings.option();
      //console.log(JSON.stringify(options));
      Settings.data(options);
    }
  }
);

// check habitica status
if (!checkHabiticaStatus) {
  var cardNoServer = new UI.Card({
    title: 'Server unavaiable',
    body: 'habitica Server is not available. Please restart.',
    scrollable: true
  });
  cardNoServer.show();
} else if(!Settings.option('userId') || !Settings.option('apiToken') || Settings.option('userId') === '' || Settings.option('apiToken') === '') {
  var cardSettingsIncomplete = new UI.Card({
    title: 'Settings incomplete',
    body: 'Please enter your credentials in the settings.',
    scrollable: true
  });
  cardSettingsIncomplete.show();
} else {
  
  // get all tasks
  var allTasks = [];
  getUserTasks();
  
  // get user object
  var user = {};
  getUserObject();
	  
  // start menu
  var mainMenu = new UI.Menu({
    highlightBackgroundColor: Feature.color('indigo', 'black'),
    sections: [{
      title: 'Tasks',
      items: [{
        title: 'Habits' 
      }, {
        title: 'Dailies'
      }, {
        title: 'To-Dos'
      }]
    }, {
      title: 'User',
      items: [{
        title: 'Skills'
      }, {
				title: 'Stats'
			}]
    }]
  });
  
  mainMenu.on('select', function(e) {
    //console.log('Selected section ' + e.sectionIndex + ' "' + e.section.title + '" item ' + e.itemIndex + ' "' + e.item.title + '"');
    if (!allTasks) {
      console.log('No tasks available');
      var cardNoTasks = new UI.Card({
        title: 'No tasks',
        body: 'Please retry.'
      });
      cardNoTasks.show();
    } else {
      //console.log('Tasks available');
			var menuAllTasks = new UI.Menu({
      	highlightBackgroundColor: Feature.color('indigo', 'black')
      });
      switch (e.sectionIndex) {
        case 0: { // tasks
          // create tasks menu
          
          switch (e.itemIndex) {
            case 0: { // habits
              menuAllTasks = createTasksMenu('habit');
              break;
            }
            case 1: { // dailies
              menuAllTasks = createTasksMenu('daily');
              break;
            }
            case 2: { // to-dos
              menuAllTasks = createTasksMenu('todo');
              break;
            }
          }
          menuAllTasks.show();
          break;
        }					
        case 1: { // user
					if (!user) {
						console.log('No user data available');
						var cardNoUser = new UI.Card({
							title: 'No user data',
							body: 'No user data available. Please retry.'
						});
						cardNoUser.show();
          } else {
						switch (e.itemIndex) {
							case 0: { // skills
									menuAllTasks = createTasksMenu('skills');
									menuAllTasks.show();
								break;
							}
							case 1: { // stats
									var cardUserStats = new UI.Card({
										title: 'User Stats',
										body: 'Health: ' + Math.round(user.stats.hp) + '/' + user.stats.maxHealth + '\n' + 'Experience: ' + user.stats.exp + '/' + user.stats.toNextLevel + ((user.stats.lvl >= 10) ? '\n' + 'Mana: ' + Math.floor(user.stats.mp) + '/' + user.stats.maxMP : '') + '\n' + 'Gold: ' + Math.floor(user.stats.gp) + '\n' + 'Level: ' + user.stats.lvl,
										scrollable: true
									});
									cardUserStats.show();
								break;
							}
					}
          break;
        	}
				}
      }
    }
  });
  mainMenu.show();
  
}

function checkHabiticaStatus() {
  var serverIsUp = false;
  ajax(
    {
      url: habiticaBaseUrl + habiticaStatus,
      type: 'json',
      async: 'false'
    },
    function(data, status, request) {
      if (data.success){
        console.log('Habitica Server Status: ' + data.data.status);
        if (data.data.status == 'up') {serverIsUp = true;}
      } else {
        console.log(data.error + ' - ' + data.message);
      }
    },
    function(error, status, request) {
      console.log('The ajax request failed: ' + error);
    }
  );
  return serverIsUp;
}

function createTasksMenu(section) {
  // initialize menu
  menu = new UI.Menu({
    highlightBackgroundColor: Feature.color('indigo', 'black')
  });
  // initialize sections
  var sectionHabits = {
    title: 'Habits',
    items: []
  };
  var sectionDailies = {
    title: 'Dailies',
    items: []
  };
  var sectionToDos = {
    title: 'To-Dos',
    items: []
  };
	
	 var sectionSkills = {
		title: 'Skills - ' + 'hp ' + Math.round(user.stats.hp) + ' mp ' + ((user.stats.lvl >= 10) ? Math.floor(user.stats.mp) + '/' + user.stats.maxMP : ''),
    items: []
  };
  
  // get tasks from allTasks and put into sectionsXY
  if(!allTasks){
    console.log('allTasks is undefined');
  } else {
    
    // get copy of allTasks
    var allTasksPrep = allTasks.slice();
    
    // get only 'section' tasks
    if (!section) {
      //console.log('Section not defined. Get all kind of tasks.');
      allTasksPrep = enrichTaskItemsByMenuFields(allTasksPrep);
      
      // put appropriate tasks into sections
      sectionHabits.items = allTasksPrep.filter(
        function(x){
          return x.type == 'habit';
        }
      ).slice();
      sectionDailies.items = allTasksPrep.filter(
        function(x){
          return x.type == 'daily' && !x.completed;
        }
      ).slice();
      sectionToDos.items = allTasksPrep.filter(
        function(x){
          return x.type == 'todo' && !x.completed;
        }
      ).slice();
			
			sectionSkills.items = allTasksPrep.filter(
        function(x){
          return x.type == 'skill' && !x.completed;
        }
      ).slice();
      
      // put sections into menu
      menu.section(0, sectionHabits);
      menu.section(1, sectionDailies);
      menu.section(2, sectionToDos);
			menu.section(3, sectionSkills);
	
    } else {
      //console.log('Section is "' + section + '". Get only these kind of tasks.');
      switch (section) {
        case 'habit': {
          sectionHabits.items = allTasksPrep.filter(
            function(x){
              return x.type == 'habit';
            }
          ).slice();
          sectionHabits.items = enrichTaskItemsByMenuFields(sectionHabits.items);
          menu.section(0, sectionHabits);
          break;
        }
        case 'daily': {
          sectionDailies.items = allTasksPrep.filter(
            function(x){
              var today = new Date();
              var startDate = new Date(x.startDate);
              //console.log('heute ist ' + today + '. Start Datum war ' + startDate + '. Differenz ist ' + (today - startDate) + '. Das sind ' + Math.floor((today - startDate)/(1000*60*60*24)) + ' Tage.');
              return x.type == 'daily' && !x.completed  && ((x.frequency == 'weekly' && x.repeat[habiticaWeekday()]) || (x.frequency == 'daily' & startDate < today && (Math.floor((today - startDate)/(1000*60*60*24)) % x.everyX === 0)));
            }
          ).slice();
					
          sectionDailies.items = enrichTaskItemsByMenuFields(sectionDailies.items);
					console.log("sectionDaies items: " + JSON.stringify(sectionDailies.items));
          menu.section(0, sectionDailies);
          break;
        }
        case 'todo': {
          sectionToDos.items = allTasksPrep.filter(
            function(x){
              return x.type == 'todo'; // should nout be necessary any more && !x.completed;
            }
          ).slice();
          sectionToDos.items = enrichTaskItemsByMenuFields(sectionToDos.items);
          menu.section(0, sectionToDos);
          break;
        }
				case 'skills': {
					switch (user.stats.class) {
						case 'warrior': {							
							sectionSkills.items = [
								{title:'T Brutal Smash', subtitle:'Tsk +Val, Slf +DMG', spellId:'smash', target:'task', type:'skill'},
								{title:'S Defensive Stance', subtitle:'Slf +CON', spellId:'defensiveStance', target:'self', type:'skill'},
								{title:'P Valorous Presence', subtitle:'Prt +STR', spellId:'valorousPresence', target:'party', type:'skill'},
								{title:'P Intimidating Gaze', subtitle:'Prt +CON',spellId:'intimidate', target:'party', type:'skill'}
							];
							break;
						}	
						case 'rogue': {
							sectionSkills.items = [
								{title:"T Pickpocket", subtitle:"Slf +Gold", spellId:"pickPocket", target:'task', type:'skill'},
								{title:"T Backstab", subtitle:"Slf +XP, +Gold", spellId:"backStab", target:'task', type:'skill'},
								{title:"P Tools of the Trade", subtitle:"Prt: +PER", spellId:"toolsOfTrade", target:'party', type:'skill'},
								{title:"P Stealth", subtitle:"Slf: +Dodge",spellId:"stealth", target:'party', type:'skill'}
							];
							break;
						}
						case 'healer': {							
							sectionSkills.items = [
								{title:'S Healing Light', subtitle:'Slf +HP', spellId:'heal', target:'player', type:'skill'},
								{title:'P Protective Aura', subtitle:'Prt +CON', spellId:'protectAura', target:'party', type:'skill'},
								{title:'P Searing Brightness', subtitle:'Tsks +Val', spellId:'brightness', target:'player', type:'skill'},
								{title:'P Blessing', subtitle:'Prt +HP',spellId:'healAll', target:'party', type:'skill'}
							];
							break;
						}
						case 'mage': {							
							sectionSkills.items = [
								{title:'T Burst of Flames', subtitle:'Slf +XP, +DMG', spellId:'fireball', target:'task', type:'skill'},
								{title:'P Ethereal Surge', subtitle:'Prt +MP', spellId:'mpHeal', target:'party', type:'skill'},
								{title:'P Earthquake', subtitle:'Prt +INT', spellId:'earth', target:'party', type:'skill'},
								{title:'S Chilling Frost', subtitle:'Streaks frozen.',spellId:'frost', target:'player', type:'skill'}
							];
							break;
						}	
					}
					
          menu.section(0, sectionSkills);
          break;
        }
      }
    }
  }
  
  menu.on('longSelect', function(e) {
    if (e.item.down === true) {
      //console.log('The selected task has .down-item.');
      if (e.item.up === false) {
        //console.log('The selected task has no .up-item.');
        scoreTaskDown(e.item);
      } else {
        var selectedTask = e;
        var cardUpDown = new UI.Card(
          {
            'title': e.item.type,
            'body': e.item.title
          }
        );
        cardUpDown.action({
          up: 'images/action_icon_plus.png',
          down: 'images/action_icon_minus.png'
        });
        cardUpDown.on('click', 'up', function(e) {
          //console.log('cardUpDown click up');
          scoreTaskUp(selectedTask.item);
          cardUpDown.hide();
        });
        cardUpDown.on('click', 'down', function(e) {
          //console.log('cardUpDown click down');
          scoreTaskDown(selectedTask.item);
          cardUpDown.hide();
        });
        cardUpDown.show();
      }
    } else {
      scoreTaskUp(e.item);
    }
  });
  
  menu.on('select', function(e) {
    //console.log('Selected item #' + e.itemIndex + ' of section #' + e.sectionIndex);
    //console.log('The item is titled "' + e.item.title + '"');
		
		// If we are casting a skill
		if (e.item.type === 'skill') {
			if (e.item.target === 'task') { console.log('Trying to cast ' + e.item.title + ', but it requires a target. Dangit!');}
			else {
				console.log('Casting ' + e.item.title + '!');
												
				menu.status({color: 'white',backgroundColor: 'black'});
				/*
				timeout = setTimeout(function() {
					menu.status({color: 'black',backgroundColor: 'white'});
					Vibe.vibrate('double');
				}, 3000);
				*/
				
				castSkill(e.item);
			}
			
		} else {
			if (e.item.down === true) {
				//console.log('The selected task has .down-item.');
				if (e.item.up === false) {
					//console.log('The selected task has no .up-item.');
					scoreTaskDown(e.item);
				} else {
					var selectedTask = e;
					var cardUpDown = new UI.Card(
						{
							'title': e.item.type,
							'body': e.item.title
						}
					);
					cardUpDown.action({
						up: 'images/action_icon_plus.png',
						down: 'images/action_icon_minus.png'
					});
					cardUpDown.on('click', 'up', function(e) {
						//console.log('cardUpDown click up');
						scoreTaskUp(selectedTask.item);
						cardUpDown.hide();
					});
					cardUpDown.on('click', 'down', function(e) {
						//console.log('cardUpDown click down');
						scoreTaskDown(selectedTask.item);
						cardUpDown.hide();
					});
					cardUpDown.show();
				}
			} else {
				//console.log('The selected task has no .down-item.');
				//console.log('Selected item is:' + JSON.stringify(e.item));
				if (typeof e.item.checklist !== 'undefined' && e.item.checklist.length > 0) {
					// access checklist
					var checklistMenu = new UI.Menu({
						highlightBackgroundColor: Feature.color('indigo', 'black')
					});
					// initialize sections
					var sectionChecklist = {
					title: 'Checklist',
					items: []
					};
					sectionChecklist.items = e.item.checklist.slice();
					sectionChecklist.items = enrichChecklistItemsByMenuFields(sectionChecklist.items, e.item.id);
					checklistMenu.section(0, sectionChecklist);
					//console.log(JSON.stringify(sectionChecklist)); // remove
					checklistMenu.on('select', function(e) {
						scoreChecklistItem(e.item);
					});
					checklistMenu.show();
					// scoreTaskUp(e.item); //remove when ready
				} else {
					// no checklist available -> just score the task
					scoreTaskUp(e.item); 
				}
			}
		}
  });
  return menu;
}

function scoreChecklistItem(checklistItem) {
  if (checklistItem) {
    if (checklistItem.id) {
      ajax(
        {
          url: habiticaBaseUrl + habiticaPostTasksChecklistScore.replace(':taskId', checklistItem.taskId).replace(':itemId', checklistItem.id),
          method: 'post',
          type: 'json',
          headers: {
            'x-api-user': Settings.option('userId'),
            'x-api-key': Settings.option('apiToken')
          }
        },
        function(data, status, request) {
          if (data.success){
            //console.log('User tasks: ' + JSON.stringify(data));
            
          } else {
            console.log(data.error + ' - ' + data.message);
          }
        },
        function(error, status, request) {
          console.log('The ajax request failed: ' + error);
        }
      );
    } else {
      console.log('Checklist item id not available.');
    }
  } else {
    console.log('Checklist item not available.');
  }
}

function enrichChecklistItemsByMenuFields(checklistArray, taskId) {
  // enrich tasks by menu relevant fields
  checklistArray = checklistArray.filter(
    function(x) {
      return !x.completed;
    }
  );
  checklistArray = checklistArray.map(
    function(x) {
      x.title = x.text;
      x.taskId = taskId;
      if (x.text.length > 20) {
        x.subtitle = '...' + x.text.substring(15);
      } else {
        x.subtitle = x.text;
      }
      return x;
    }
  );
  return checklistArray;
}

function getUserTasks() {
  ajax(
    {
      url: habiticaBaseUrl + habiticaGetTasksUser,
      type: 'json',
      headers: {
        'x-api-user': Settings.option('userId'),
        'x-api-key': Settings.option('apiToken')
      }
    },
    function(data, status, request) {
      if (data.success){
        //console.log('User tasks: ' + JSON.stringify(data));
        allTasks = data.data;
      } else {
        console.log(data.error + ' - ' + data.message);
      }
    },
    function(error, status, request) {
      console.log('The ajax request failed: ' + error);
    }
  );
}

function scoreTaskUp(task) {
  if (task) {
    if (task.id) {
      ajax(
        {
          url: habiticaBaseUrl + habiticaPostTasksScore.replace(':taskId', task.id).replace(':direction', 'up'),
          method: 'post',
          type: 'json',
          headers: {
            'x-api-user': Settings.option('userId'),
            'x-api-key': Settings.option('apiToken')
          }
        },
        function(data, status, request) {
          if (data.success){
            //console.log('User tasks: ' + JSON.stringify(data));
            // update users stats
            user.stats.hp = data.data.hp;
            user.stats.mp = data.data.mp;
            user.stats.exp = data.data.exp;
            user.stats.gp = data.data.gp;
            user.stats.lvl = data.data.lvl;
          } else {
            console.log(data.error + ' - ' + data.message);
          }
        },
        function(error, status, request) {
          console.log('The ajax request failed: ' + error);
        }
      );
    } else {
      console.log('Task id not available.');
    }
  } else {
    console.log('Task not available.');
  }
}

function scoreTaskDown(task) {
  if (task) {
    if (task.id) {
      ajax(
        {
          url: habiticaBaseUrl + habiticaPostTasksScore.replace(':taskId', task.id).replace(':direction', 'down'),
          method: 'post',
          type: 'json',
          headers: {
            'x-api-user': Settings.option('userId'),
            'x-api-key': Settings.option('apiToken')
          }
        },
        function(data, status, request) {
          if (data.success){
            //console.log('User tasks: ' + JSON.stringify(data));
            // update users stats
            user.stats.hp = data.data.hp;
            user.stats.mp = data.data.mp;
            user.stats.exp = data.data.exp;
            user.stats.gp = data.data.gp;
            user.stats.lvl = data.data.lvl;
          } else {
            console.log(data.error + ' - ' + data.message);
          }
        },
        function(error, status, request) {
          console.log('The ajax request failed: ' + error);
        }
      );
    } else {
      console.log('Task id not available.');
    }
  } else {
    console.log('Task not available.');
  }
}

function castSkill(skill) {
  if (skill) {
    if (skill.spellId) {
      ajax(
        {
          url: habiticaBaseUrl + habiticaPostSkillCast.replace(':spellId', skill.spellId),
          method: 'post',
          type: 'json',
          headers: {
            'x-api-user': Settings.option('userId'),
            'x-api-key': Settings.option('apiToken')
          }
        },
        function(data, status, request) {
          if (data.success){
            //console.log('User tasks: ' + JSON.stringify(data));
						console.log('Casting successfull');
						
						clearTimeout(timeout);
						menu.status({color: 'black',backgroundColor: 'white'});
						Vibe.vibrate('short');
						
            // update users stats
            user.stats.hp = data.data.hp;
            user.stats.mp = data.data.mp;
            user.stats.exp = data.data.exp;
            user.stats.gp = data.data.gp;
            user.stats.lvl = data.data.lvl;
          } else {
            console.log(data.error + ' - ' + data.message);
          }
        },
        function(error, status, request) {
          console.log('The ajax request failed: ' + error);
        }
      );
    } else {
      console.log('SkillID not available.');
    }
  } else {
    console.log('Skill not available.');
  }
}

function getUserObject() {
  ajax(
    {
      url: habiticaBaseUrl + habiticaGetUser,
      type: 'json',
      headers: {
        'x-api-user': Settings.option('userId'),
        'x-api-key': Settings.option('apiToken')
      }
    },
    function(data, status, request) {
      if (data.success){
        console.log('User object: ' + JSON.stringify(data));
        user = data.data;
      } else {
        console.log(data.error + ' - ' + data.message);
      }
    },
    function(error, status, request) {
      console.log('The ajax request failed: ' + error);
    }
  );
}

function enrichTaskItemsByMenuFields(tasksArray) {
  // enrich tasks by menu relevant fields
  tasksArray = tasksArray.map(
    function(x) {
      var strChecklist = '';
      if (typeof x.checklist !== 'undefined' && x.checklist.length > 0) {
        var checkedItems = x.checklist.filter(function(value) {
          return value.completed;
        }).length;
        strChecklist = checkedItems + '/' + x.checklist.length;
      }
      x.title = x.text;
      if (x.text.length > 14) {
        if (x.text.length > 20) {
          if (strChecklist === '') {
            x.subtitle = '...' + x.text.substring(15);
          } else {
            x.subtitle = '...' + x.text.substring(15, 30) + ' ' + strChecklist;
          }
        } else {
          x.subtitle = x.text + ' ' + strChecklist;
        }
      } else {
        x.subtitle = x.text + ' ' + strChecklist;
      }
      return x;
    }
  );
  return tasksArray;
}

function habiticaWeekday(date) {
  var weekday = new Array(7);
  weekday[0] = "su";
  weekday[1] = "m";
  weekday[2] = "t";
  weekday[3] = "w";
  weekday[4] = "th";
  weekday[5] = "f";
  weekday[6] = "s";
  
  if (!date) {
    var today = new Date();
    return weekday[today.getDay()];
  } else {
    return weekday[date.getDay()];
  }
}

function getMatchingStr4MenuItemTitle(input) {
  var output = '';
  var charWidth = new Array([]);
  charWidth[97] = 9;
  charWidth[98] = 9;
  charWidth[99] = 9;
  charWidth[100] = 9;
  charWidth[101] = 9;
  charWidth[102] = 7;
  charWidth[103] = 9;
  charWidth[104] = 9;
  charWidth[105] = 4;
  charWidth[106] = 4;
  charWidth[107] = 9;
  charWidth[108] = 4;
  charWidth[109] = 14;
  charWidth[110] = 9;
  charWidth[111] = 9;
  charWidth[112] = 9;
  charWidth[113] = 9;
  charWidth[114] = 7;
  charWidth[115] = 7;
  charWidth[116] = 7;
  charWidth[117] = 9;
  charWidth[118] = 9;
  charWidth[119] = 11;
  charWidth[120] = 9;
  charWidth[121] = 9;
  charWidth[122] = 7;
  
  for (var i = 0; i < input.length; i++){
    
  }
  return output;
}