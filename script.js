// script.js
const TEAM_COLORS = {
    ABD: "#e2001a",
    CEL: "#16973b",
    HEA: "#800910",
    HIB: "#005000",
    KIL: "#0e00f7",
    MOT: "#ffbe00",
    RAN: "#1b458f",
    SMN: "#000000",
    SJN: "#243f90",
    DUN: "#1a315a",
    DDU: "#f29400",
    ROS: "#040957"
};

const PLAYER_ROLES = {
    NONE: 'none',
    CAPTAIN: 'captain',
    VICE_CAPTAIN: 'vice_captain'
};

const ROLE_MULTIPLIERS = {
    [PLAYER_ROLES.NONE]: 1,
    [PLAYER_ROLES.CAPTAIN]: 2,
    [PLAYER_ROLES.VICE_CAPTAIN]: 1.5
};

class FantasyState {
    constructor() {
        this.unsavedChanges = [];
        this.records = [];
    }

    addChange(change) {
        this.unsavedChanges.push(change);
    }

    clearChanges() {
        this.unsavedChanges = [];
    }

    setRecords(records) {
        this.records = records;
    }
}

class AirtableService {
    constructor() {
        this.apiKey = "patIQZcsLZw1aCILS.3d2edb2f1380092318363d8ffd99f1a695ff6db84c300d36e2be82288d4b3489";
        this.baseId = "appoF7fRSS4nuF9u2";
        this.tableName = "Table%201";  // URL encoded space
        this.url = `https://api.airtable.com/v0/${this.baseId}/${this.tableName}`;
    }

    async fetchData() {
        try {
            const response = await fetch(this.url, {
                headers: { 
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`Failed to fetch: ${response.statusText}`);
            }
            
            const data = await response.json();
            return data.records;
        } catch (error) {
            console.error("Fetch error:", error);
            throw error;
        }
    }

    async publishChange(change) {
        try {
            // Ensure numeric fields are sent as numbers or empty strings
            const sanitizedFields = {};
            Object.keys(change.fields).forEach(key => {
                let value = change.fields[key];
                if (key === "score" || key === "value") {
                    value = value === '' ? '' : parseFloat(value);
                }
                sanitizedFields[key] = value;
            });

            const response = await fetch(`${this.url}/${change.id}`, {
                method: "PATCH",
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ fields: sanitizedFields })
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Update failed for ${change.id}: ${errorText}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error(`Error updating ${change.id}:`, error);
            throw error;
        }
    }
}

class PlayerComponent {
    constructor(record, state, onUpdate) {
        this.record = record;
        this.state = state;
        this.onUpdate = onUpdate;
    }

    createElements() {
        const { fields } = this.record;
        const playerDiv = document.createElement("div");
        playerDiv.className = "player";

        const elements = {
            roleContainer: this.createRoleContainer(),
            circle: this.createPositionCircle(),
            name: this.createInput("name", fields.name),
            team: this.createTeamSelect(),
            value: this.createInput("value", this.formatValue(fields.value)),
            score: this.createScoreInput(fields.score)
        };

        Object.values(elements).forEach(element => playerDiv.appendChild(element));
        return playerDiv;
    }

    createRoleContainer() {
        const container = document.createElement("div");
        container.className = "role-container";
        
        const role = this.record.fields.role || PLAYER_ROLES.NONE;
        
        // Create role button
        const roleButton = document.createElement("button");
        roleButton.className = "role-button";
        roleButton.textContent = this.getRoleDisplay(role);
        roleButton.dataset.role = role;
        roleButton.addEventListener("click", () => this.cycleRole(roleButton));
        
        container.appendChild(roleButton);
        return container;
    }

    getRoleDisplay(role) {
        switch(role) {
            case PLAYER_ROLES.CAPTAIN:
                return "©";
            case PLAYER_ROLES.VICE_CAPTAIN:
                return "ⓥ";
            default:
                return "☆";
        }
    }

    cycleRole(button) {
        const currentRole = button.dataset.role;
        const teamPrefix = this.record.fields.player_id.startsWith("ell") ? "ells" : "jacks";
        
        // Determine next role
        let nextRole;
        switch(currentRole) {
            case PLAYER_ROLES.NONE:
                nextRole = PLAYER_ROLES.CAPTAIN;
                break;
            case PLAYER_ROLES.CAPTAIN:
                nextRole = PLAYER_ROLES.VICE_CAPTAIN;
                break;
            default:
                nextRole = PLAYER_ROLES.NONE;
        }

        // Check if the role is already assigned to another player
        if (nextRole !== PLAYER_ROLES.NONE) {
            const existingRoleHolder = document.querySelector(
                `#${teamPrefix}-gk .role-button[data-role="${nextRole}"], ` +
                `#${teamPrefix}-def .role-button[data-role="${nextRole}"], ` +
                `#${teamPrefix}-mid .role-button[data-role="${nextRole}"], ` +
                `#${teamPrefix}-fwd .role-button[data-role="${nextRole}"]`
            );

            if (existingRoleHolder) {
                existingRoleHolder.dataset.role = PLAYER_ROLES.NONE;
                existingRoleHolder.textContent = this.getRoleDisplay(PLAYER_ROLES.NONE);
                
                // Update Airtable record for the previous role holder
                this.state.addChange({
                    id: existingRoleHolder.closest('.player').querySelector('input').dataset.id,
                    fields: { role: PLAYER_ROLES.NONE }
                });
            }
        }

        // Update button and save change
        button.dataset.role = nextRole;
        button.textContent = this.getRoleDisplay(nextRole);
        
        this.state.addChange({
            id: this.record.id,
            fields: { role: nextRole }
        });

        this.onUpdate();
    }

    createPositionCircle() {
        const circle = document.createElement("div");
        const { fields } = this.record;
        const positionType = fields.player_id.split("-")[1];
        
        circle.className = "position-circle";
        circle.textContent = positionType.toUpperCase();
        circle.style.backgroundColor = fields.bench ? "#888888" : TEAM_COLORS[fields.team] || "#cccccc";
        circle.dataset.id = this.record.id;
        circle.dataset.bench = fields.bench || false;
        circle.dataset.team = fields.team;
        
        circle.addEventListener("click", () => this.toggleBench(circle));
        
        return circle;
    }

    formatValue(value) {
        if (value === undefined || value === null || value === '') {
            return '';
        }
        return `£${parseFloat(value).toFixed(1)}`;
    }

    createScoreInput(score) {
        const input = document.createElement("input");
        input.value = score || '';
        input.dataset.field = "score";
        input.dataset.id = this.record.id;
        input.style.backgroundColor = "white";
        input.addEventListener("blur", (e) => this.handleChange(e));
        return input;
    }

    createInput(field, value) {
        const input = document.createElement("input");
        input.value = value || '';
        input.dataset.field = field;
        input.dataset.id = this.record.id;
        
        if (field !== "score") {
            input.style.backgroundColor = this.record.fields.player_id.startsWith("ell") ? "#ffcccc" : "#cceeff";
        }
        
        input.addEventListener("blur", (e) => this.handleChange(e));
        return input;
    }

    createTeamSelect() {
        const select = document.createElement("select");
        select.dataset.field = "team";
        select.dataset.id = this.record.id;
        
        Object.keys(TEAM_COLORS).forEach(team => {
            const option = document.createElement("option");
            option.value = team;
            option.textContent = team;
            option.selected = team === this.record.fields.team;
            select.appendChild(option);
        });

        select.addEventListener("change", (e) => {
            this.handleChange(e);
            this.updateTeamColors(select);
        });
        
        this.updateTeamColors(select);
        return select;
    }

    toggleBench(circle) {
        const newBenchStatus = circle.dataset.bench !== "true";
        circle.dataset.bench = newBenchStatus;
        circle.style.backgroundColor = newBenchStatus ? "#888888" : TEAM_COLORS[circle.dataset.team];
        
        this.state.addChange({
            id: circle.dataset.id,
            fields: { bench: newBenchStatus }
        });
    }

    handleChange(event) {
        const input = event.target;
        let value = input.value.trim();
        
        if (value === '') {
            value = '';
        } else if (input.dataset.field === "score" || input.dataset.field === "value") {
            value = input.dataset.field === "value" ? 
                parseFloat(value.replace('£', '')) || 0 :
                parseFloat(value) || 0;
        }

        this.state.addChange({
            id: input.dataset.id,
            fields: { [input.dataset.field]: value }
        });

        if (input.dataset.field === "score" || input.dataset.field === "value") {
            this.onUpdate();
        }
    }

    updateTeamColors(select) {
        const selectedTeam = select.value;
        select.style.backgroundColor = TEAM_COLORS[selectedTeam];
        select.style.color = "white";
    }
}

class FantasyFootballApp {
    constructor() {
        this.state = new FantasyState();
        this.api = new AirtableService();
        this.init();
    }

    async init() {
        document.addEventListener("DOMContentLoaded", () => this.loadData());
    }

    async loadData() {
        try {
            const records = await this.api.fetchData();
            this.state.setRecords(records);
            this.displayPlayers(records);
        } catch (error) {
            console.error("Failed to load data:", error);
        }
    }

    displayPlayers(records) {
        ["ells", "jacks"].forEach(team => {
            ["gk", "def", "mid", "fwd"].forEach(position => {
                document.getElementById(`${team}-${position}`).innerHTML = "";
            });
        });

        records.forEach(record => {
            if (!record.fields?.player_id) return;

            const component = new PlayerComponent(record, this.state, () => this.updateScores());
            const playerElement = component.createElements();
            
            const { player_id } = record.fields;
            const teamPrefix = player_id.startsWith("ell") ? "ells" : "jacks";
            const positionType = player_id.split("-")[1];
            
            document.getElementById(`${teamPrefix}-${positionType}`)?.appendChild(playerElement);
        });

        this.updateScores();
    }

    updateScores() {
        const scores = {
            ell: 0,
            jack: 0
        };
        const values = {
            ell: 0,
            jack: 0
        };

        document.querySelectorAll(".player").forEach(player => {
            // Calculate scores with role multiplier
            const scoreInput = player.querySelector("input[data-field='score']");
            const scoreValue = scoreInput.value.trim();
            const baseScore = scoreValue === '' ? 0 : (parseFloat(scoreValue) || 0);
            
            const roleButton = player.querySelector('.role-button');
            const role = roleButton ? roleButton.dataset.role : PLAYER_ROLES.NONE;
            const multiplier = ROLE_MULTIPLIERS[role] || 1;
            const finalScore = baseScore * multiplier;
            
            // Calculate values (unchanged)
            const valueInput = player.querySelector("input[data-field='value']");
            const valueText = valueInput.value.trim().replace('£', '');
            const value = valueText === '' ? 0 : (parseFloat(valueText) || 0);
            
            const team = player.parentElement.id.startsWith("ells") ? "ell" : "jack";
            scores[team] += finalScore;
            values[team] += value;
        });

        // Update scores and values
        document.getElementById("jacks-score").textContent = scores.jack;
        document.getElementById("ells-score").textContent = scores.ell;
        document.getElementById("winner-display").textContent = 
            scores.ell > scores.jack ? "Ell" : 
            scores.jack > scores.ell ? "Jack" : "Draw";

        document.getElementById("jacks-value").textContent = `£${values.jack.toFixed(1)}`;
        document.getElementById("ells-value").textContent = `£${values.ell.toFixed(1)}`;
    }

    async publishChanges() {
        if (this.state.unsavedChanges.length === 0) {
            alert("No changes to publish.");
            return;
        }

        try {
            const results = await Promise.all(
                this.state.unsavedChanges.map(change => this.api.publishChange(change))
            );
            
            console.log("Changes published:", results);
            alert("All changes published successfully!");
            this.state.clearChanges();
            this.updateScores();
        } catch (error) {
            console.error("Failed to publish changes:", error);
            alert("Error publishing changes. Please check your connection or contact support.");
        }
    }
}

// Initialize application
const app = new FantasyFootballApp();
