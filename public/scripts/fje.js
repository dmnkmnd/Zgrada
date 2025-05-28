
function atLeastOne(){
    console.log("provjeravam")
    const checkboxes = Array.from(document.querySelectorAll(".checkbox"));
    return checkboxes.reduce((acc, curr) => acc || curr.checked, false);
}

function seeform(id){
    var form = document.getElementById(id);
    form.style.display = "block"; 
}

function noseeform(id){
    var form = document.getElementById(id);
    form.style.display = "block"; 
}


function seeformData(){
    var form = document.getElementById('meta');
    form.style.display = "block"; 
}

function addField(formaId, addFieldId) {
    const form = document.getElementById(formaId);
    const addFieldDiv = document.getElementById(addFieldId);


    const newSection = document.createElement('div');
    newSection.classList.add('zahtjev');

    const emailDiv = document.createElement('div');
    emailDiv.innerHTML = `
        <label>Email (su)vlasnika jedinice:</label>
        <input type="text" name="email" maxlength="40" required>
    `;

    const udioDiv = document.createElement('div');
    udioDiv.innerHTML = `
        <label> Udio u vlasništvu ([0.0000 , 1.0000]):</label>
        <input type="number" name="udio" step="0.0001" min="0" max="1" required >
    `;


    newSection.appendChild(emailDiv);
    newSection.appendChild(udioDiv);

    form.insertBefore(newSection, addFieldDiv.nextSibling);
}

console.log("provjeravam");