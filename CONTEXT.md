# Personal Agent

A Personal Agent helps one user execute everyday tasks by planning work, using tools, remembering useful context, and asking for confirmation when needed.

## Language

**Personal Agent**:
An AI assistant owned by one user for executing that user's everyday tasks through planning, tool use, memory, and confirmation.
_Avoid_: Universal Agent, General Agent, Agent Framework

**Workspace Task**:
A task whose relevant inputs and outputs belong to the user's active workspace, such as project files, notes, commands, or local working context.
_Avoid_: Everything Task, Life Task, Any Task

**Confirmation Gate**:
A required pause before a Personal Agent performs a high-impact action, so the user can approve, reject, or adjust the action.
_Avoid_: Permission Prompt, Safety Popup, Manual Mode

**Clarification Gate**:
A required pause when the Owner's intent is unclear enough to affect task boundaries, workspace changes, command execution, or the Success Check.
_Avoid_: Confirmation Gate, Guess, Generic Question

**Project Memory**:
Long-lived knowledge tied to one workspace, covering stable facts and preferences that help the Personal Agent perform future Workspace Tasks in that workspace.
_Avoid_: Global Memory, Chat History, User Profile

**Task Plan**:
The current execution route for a Workspace Task, describing the next meaningful steps the Personal Agent intends to take and allowing revision as new observations arrive.
_Avoid_: Chain of Thought, Script, Checklist

**Local Tool**:
An executable capability available in the user's local environment for inspecting or changing workspace state, such as reading files, searching directories, or running commands.
_Avoid_: Remote Tool, External Integration, Skill

**Skill Pack**:
A bundled capability description that teaches the Personal Agent when and how to use a specialized ability, often including instructions, scripts, references, or evaluations.
_Avoid_: Tool, Plugin, Prompt Snippet

**Guided Skill Use**:
The Personal Agent uses a Skill Pack as instructions and supporting resources for a Workspace Task, while Local Tools remain the actions that change or inspect state.
_Avoid_: Plugin Runtime, Autonomous Skill Execution

**Model Provider**:
The external model service boundary that supplies reasoning and language generation for the Personal Agent.
_Avoid_: Model Router, Brain, LLM Backend

**Agent Step**:
One visible decision made by the Personal Agent during a Task Run, such as responding to the Owner, revising a Task Plan, using a Local Tool, requesting a Confirmation Gate, or finishing with a Task Report.
_Avoid_: Provider Tool Call, Raw Model Output, Hidden Reasoning

**Task Run**:
One execution of a Workspace Task, including the user's goal, current Task Plan, Local Tool activity, observations, Confirmation Gate decisions, and final result.
_Avoid_: Session, Log, Checkpoint

**Checkpoint**:
A saved point inside a Task Run that lets the Personal Agent resume after interruption without re-inferring completed work.
_Avoid_: Full Rollback, Undo Point, Task Run

**Workspace State**:
Personal Agent state stored with one workspace, including Project Memory, Task Runs, Checkpoints, and workspace-specific configuration.
_Avoid_: Global State, Cloud State, User Database

**Reflection Note**:
A proposed learning from a completed Task Run that may become Project Memory or a Skill Pack improvement only after user confirmation.
_Avoid_: Automatic Learning, Self-Modification, Memory Write

**Owner**:
The single person who uses the Personal Agent, approves Confirmation Gates, and decides what becomes durable Workspace State.
_Avoid_: Account, Tenant, Team Member

**Advisory Mode**:
A Personal Agent mode for analysis, planning, and explanation without changing workspace state.
_Avoid_: Read-Only Mode, Chat Mode

**Execution Mode**:
A Personal Agent mode that may change workspace state through Local Tools while still respecting Confirmation Gates for high-impact actions.
_Avoid_: Autonomous Mode, Write Mode

**Decision Trace**:
A concise, user-facing record of why a Personal Agent chose a Task Plan, Local Tools, Skill Packs, and Confirmation Gates during a Task Run.
_Avoid_: Chain of Thought, Hidden Reasoning, Debug Log

**Recovery Attempt**:
A limited attempt inside a Task Run to recover from a failed Local Tool call, invalid model output, or other correctable interruption.
_Avoid_: Infinite Retry, Self-Healing, Silent Failure

**Task Conversation**:
The multi-turn interaction between the Owner and the Personal Agent around one Task Run, including clarification, confirmation, plan revision, and continuation.
_Avoid_: Chat Session, Prompt, Message Thread

**Task Report**:
The user-facing summary produced at the end of a Task Run, covering the outcome, important changes, verification, unresolved questions, and proposed Reflection Notes.
_Avoid_: Final Message, Log Summary, Transcript

**Success Check**:
The explicit check used to decide whether a Task Run has met the Owner's goal, such as a generated artifact, passing command, reviewed summary, or acknowledged limitation.
_Avoid_: Done Feeling, Final Answer, Test Only

**Learning Lens**:
A lightweight explanation layer that connects visible Personal Agent behavior to agent concepts the Owner wants to learn.
_Avoid_: Tutorial Mode, Lecture Mode, Debug Commentary

**Knowledge Base**:
The bilingual learner-facing documentation for the Personal Agent, explaining implemented capabilities, alternatives, trade-offs, and evaluation methods in English and Chinese.
_Avoid_: Project Memory, README, Scratch Notes

**Capability Backlog**:
The explicit list of valuable capabilities that are intentionally deferred from the current Personal Agent version.
_Avoid_: Scope Creep, Hidden Roadmap, Maybe Later

**Single Active Task Run**:
A workspace rule that only one Task Run may be active at a time, while completed Task Runs remain available as history.
_Avoid_: Parallel Runs, Background Swarm, Multi-Agent Queue

**External Review**:
An optional independent inspection of a Task Run result by an agent outside the Personal Agent, such as through Agent Bridge.
_Avoid_: Core Execution, Required Approval, Consumer Agent

**Run Export**:
A shareable summary of a Task Run for reflection, debugging, or External Review, containing the Task Report, Decision Trace, key events, and important workspace changes.
_Avoid_: Full Replay, Backup, Transcript Dump

**Task Evaluation**:
The post-run assessment of whether a Task Run met its Success Check, respected gates, produced a usable Task Report, and left useful learning or improvement signals.
_Avoid_: Test Only, User Rating, Vibe Check

## Example Dialogue

Developer: "I want to build a general agent."

Domain expert: "Do you mean a reusable agent framework or a Personal Agent for your own tasks?"

Developer: "A Personal Agent. I want something I can use directly while learning how agents work."

Developer: "Should it handle all my personal affairs right away?"

Domain expert: "Start with Workspace Tasks. External-account tasks like email, calendar, shopping, or payment belong outside the first boundary."

Developer: "Can the Personal Agent just run everything by itself?"

Domain expert: "It may inspect and plan freely, but high-impact actions pass through a Confirmation Gate first."

Developer: "Should it guess when my request is ambiguous?"

Domain expert: "Only for low-risk details. When ambiguity affects the boundary or Success Check, use a Clarification Gate."

Developer: "Should it remember everything I say?"

Domain expert: "No. Store Project Memory only when the knowledge is stable, workspace-specific, and useful for future Workspace Tasks."

Developer: "Should the Personal Agent always plan first?"

Domain expert: "For non-simple Workspace Tasks, yes. It should create a Task Plan before acting and revise the plan when observations change the route."

Developer: "Are skills the same thing as tools?"

Domain expert: "No. A Local Tool performs an action. A Skill Pack teaches the Personal Agent when and how a specialized ability should be used."

Developer: "Should the first Personal Agent run Skill Packs as plugins?"

Domain expert: "No. Start with Guided Skill Use so Skill Packs guide planning and tool choice without becoming their own runtime."

Developer: "Should the first Personal Agent support many models?"

Domain expert: "No. Keep a Model Provider boundary, but implement one provider first."

Developer: "Should the model provider's native tool call format define the agent loop?"

Domain expert: "No. Use Agent Steps as the Personal Agent's own visible action language, then adapt model output into that language."

Developer: "How do we know what the Personal Agent did for a task?"

Domain expert: "Record a Task Run. It is the complete execution record for one Workspace Task."

Developer: "Is a Task Run the same as a checkpoint?"

Domain expert: "No. A Task Run is the whole execution record; a Checkpoint is a resumable point inside it."

Developer: "Where should the Personal Agent remember things?"

Domain expert: "Use Workspace State first, so memory and execution records stay tied to the workspace they describe."

Developer: "Can the Personal Agent learn automatically from every task?"

Domain expert: "It can propose Reflection Notes, but durable learning must pass a Confirmation Gate."

Developer: "Who is the first Personal Agent for?"

Domain expert: "The Owner. First make it useful and safe for one person before adding teams or accounts."

Developer: "Sometimes I want to learn, not execute."

Domain expert: "Use Advisory Mode for analysis and explanation; use Execution Mode when the Personal Agent should change workspace state."

Developer: "Should we save the model's full reasoning?"

Domain expert: "No. Save a Decision Trace that explains the visible decisions without relying on hidden reasoning."

Developer: "What should happen when a tool fails?"

Domain expert: "The Personal Agent may make a bounded Recovery Attempt, then ask the Owner when failure continues or the next action is risky."

Developer: "Is every message a new task?"

Domain expert: "No. A Task Conversation may contain many messages while one Task Run is being clarified, executed, paused, or resumed."

Developer: "What should the Personal Agent produce when it finishes?"

Domain expert: "It should produce a Task Report that explains the outcome, verification, unresolved issues, and any Reflection Notes."

Developer: "How does the Personal Agent know a task is done?"

Domain expert: "Use a Success Check. When objective verification is unavailable, say so in the Task Report."

Developer: "I also want to learn agent concepts while using it."

Domain expert: "Use a Learning Lens: brief explanations of concepts like planning, tool use, observation, reflection, and checkpoints at useful moments."

Developer: "Where should explanations of how the Personal Agent is built live?"

Domain expert: "Use the Knowledge Base. Project Memory stores what helps future tasks; the Knowledge Base teaches how the agent works."

Developer: "Where do we put embedding search and network access if they are not in the first version?"

Domain expert: "Put them in the Capability Backlog so they remain visible without expanding the MVP boundary."

Developer: "Can it run several tasks at once?"

Domain expert: "Not in the first version. Use Single Active Task Run so confirmation, recovery, and workspace changes stay understandable."

Developer: "Should Agent Bridge be part of the Personal Agent core?"

Domain expert: "No. Agent Bridge can provide External Review for selected Task Runs, but the Personal Agent should run without it."

Developer: "How do we give another agent enough context to review a task?"

Domain expert: "Create a Run Export. It should summarize the Task Run without dumping every internal detail."

Developer: "How do we judge a completed Task Run?"

Domain expert: "Run a Task Evaluation against the Success Check, safety gates, Decision Trace, Task Report, and learning signals."
