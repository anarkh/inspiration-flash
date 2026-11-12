// Node 22+ runs a directory argument (`node --test prototype/action-combat-v1/tests/`) as a module, i.e. this file;
// it loads every test file so the directory form and the glob form run the same tests. (bots.mjs is a helper.)
import './sim.test.mjs?v=6';
import './input.test.mjs?v=6';
import './anim.test.mjs?v=6';
