export default function ListItem({ name }: { name: string }) {
    return (
        <li className="p-2.5 bg-[#313244] rounded-md transition duration-200 hover:bg-[#45475a] hover:translate-x-1 cursor-pointer">
            {name}
        </li>
    );
}
