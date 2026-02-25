// import React from 'react';
import ListItem from '../components/ListItem';

function App() {
    return (
        <div className="font-sans w-[300px] p-4 bg-[#1e1e2e] text-[#cdd6f4] rounded-lg">
            <h1 className="text-2xl mt-0 text-[#89b4fa] border-b-2 border-[#313244] pb-2 mb-4">
                RoboKJ
            </h1>
            <ul className="list-none p-0 m-0 space-y-2">
                <ListItem name="Bob" />
                <ListItem name="Carol" />
                <ListItem name="Ted" />
                <ListItem name="Alice" />
            </ul>
        </div>
    );
}

export default App;
