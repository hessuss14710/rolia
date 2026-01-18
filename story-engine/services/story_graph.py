"""
Story Graph Service.
Manages the graph of story decisions, branches, and pathfinding to endings.
"""

import networkx as nx
from typing import Optional, List, Dict, Any, Set, Tuple
from dataclasses import dataclass


@dataclass
class StoryNode:
    """A node in the story graph."""
    node_id: str
    node_type: str  # 'scene', 'decision', 'ending'
    title: str
    act: int = 1
    chapter: int = 1
    scene: int = 1
    data: Dict[str, Any] = None


@dataclass
class StoryEdge:
    """An edge in the story graph."""
    from_node: str
    to_node: str
    condition: Optional[str] = None  # Condition for this path
    probability: float = 1.0  # Base probability of taking this path
    label: Optional[str] = None


class StoryGraph:
    """
    Manages the story structure as a directed graph.
    Provides pathfinding, branch analysis, and ending probability calculations.
    """

    def __init__(self):
        """Initialize the story graph."""
        self.graph = nx.DiGraph()
        self._endings: Set[str] = set()
        self._decision_points: Set[str] = set()

    def add_node(self, node: StoryNode) -> None:
        """Add a node to the graph."""
        self.graph.add_node(
            node.node_id,
            node_type=node.node_type,
            title=node.title,
            act=node.act,
            chapter=node.chapter,
            scene=node.scene,
            data=node.data or {}
        )

        if node.node_type == 'ending':
            self._endings.add(node.node_id)
        elif node.node_type == 'decision':
            self._decision_points.add(node.node_id)

    def add_edge(self, edge: StoryEdge) -> None:
        """Add an edge to the graph."""
        self.graph.add_edge(
            edge.from_node,
            edge.to_node,
            condition=edge.condition,
            probability=edge.probability,
            label=edge.label
        )

    def get_node(self, node_id: str) -> Optional[Dict[str, Any]]:
        """Get node data."""
        if node_id in self.graph.nodes:
            return dict(self.graph.nodes[node_id])
        return None

    def get_successors(self, node_id: str) -> List[Dict[str, Any]]:
        """Get all possible next nodes from a given node."""
        successors = []
        for succ_id in self.graph.successors(node_id):
            edge_data = self.graph.edges[node_id, succ_id]
            node_data = self.graph.nodes[succ_id]
            successors.append({
                "node_id": succ_id,
                "node_type": node_data.get("node_type"),
                "title": node_data.get("title"),
                "condition": edge_data.get("condition"),
                "probability": edge_data.get("probability", 1.0),
            })
        return successors

    def get_predecessors(self, node_id: str) -> List[Dict[str, Any]]:
        """Get all nodes that lead to a given node."""
        predecessors = []
        for pred_id in self.graph.predecessors(node_id):
            edge_data = self.graph.edges[pred_id, node_id]
            node_data = self.graph.nodes[pred_id]
            predecessors.append({
                "node_id": pred_id,
                "node_type": node_data.get("node_type"),
                "title": node_data.get("title"),
                "condition": edge_data.get("condition"),
            })
        return predecessors

    def find_paths_to_endings(
        self,
        from_node: str
    ) -> Dict[str, List[List[str]]]:
        """Find all paths from a node to each ending."""
        paths_by_ending = {}

        for ending_id in self._endings:
            try:
                paths = list(nx.all_simple_paths(
                    self.graph,
                    from_node,
                    ending_id
                ))
                if paths:
                    paths_by_ending[ending_id] = paths
            except nx.NetworkXNoPath:
                continue

        return paths_by_ending

    def calculate_ending_probabilities(
        self,
        current_node: str,
        decisions_made: Dict[str, str],
        story_flags: Dict[str, Any]
    ) -> Dict[str, float]:
        """
        Calculate probabilities for each ending based on current state.
        """
        # Get all paths to endings
        paths_by_ending = self.find_paths_to_endings(current_node)

        if not paths_by_ending:
            return {}

        probabilities = {}
        total_weight = 0.0

        for ending_id, paths in paths_by_ending.items():
            # Calculate average path weight
            path_weights = []

            for path in paths:
                weight = self._calculate_path_weight(
                    path, decisions_made, story_flags
                )
                path_weights.append(weight)

            # Use the best path's weight for this ending
            ending_weight = max(path_weights) if path_weights else 0.0
            probabilities[ending_id] = ending_weight
            total_weight += ending_weight

        # Normalize to percentages
        if total_weight > 0:
            for ending_id in probabilities:
                probabilities[ending_id] = round(
                    (probabilities[ending_id] / total_weight) * 100, 1
                )

        return probabilities

    def _calculate_path_weight(
        self,
        path: List[str],
        decisions_made: Dict[str, str],
        story_flags: Dict[str, Any]
    ) -> float:
        """Calculate weight/probability for a specific path."""
        weight = 1.0

        for i in range(len(path) - 1):
            from_node = path[i]
            to_node = path[i + 1]

            edge_data = self.graph.edges.get((from_node, to_node), {})
            condition = edge_data.get("condition")
            base_prob = edge_data.get("probability", 1.0)

            # Apply base probability
            weight *= base_prob

            # Check condition satisfaction
            if condition:
                satisfied = self._check_condition(
                    condition, decisions_made, story_flags
                )
                if not satisfied:
                    weight *= 0.1  # Heavily penalize unsatisfied conditions

        return weight

    def _check_condition(
        self,
        condition: str,
        decisions_made: Dict[str, str],
        story_flags: Dict[str, Any]
    ) -> bool:
        """Check if a condition is satisfied."""
        # Parse condition string (simple format: "flag:value" or "decision:code:option")
        parts = condition.split(":")

        if len(parts) == 2:
            # Flag check: "flag_name:true/false"
            flag_name, expected = parts
            actual = story_flags.get(flag_name)
            if expected.lower() == "true":
                return bool(actual)
            elif expected.lower() == "false":
                return not actual
            else:
                return str(actual) == expected

        elif len(parts) == 3 and parts[0] == "decision":
            # Decision check: "decision:code:option"
            _, decision_code, expected_option = parts
            actual_option = decisions_made.get(decision_code)
            return actual_option == expected_option

        return True  # Unknown condition format, assume satisfied

    def get_decision_points_ahead(
        self,
        current_node: str,
        max_depth: int = 5
    ) -> List[Dict[str, Any]]:
        """Get upcoming decision points within a certain depth."""
        decision_points = []
        visited = set()

        def explore(node_id: str, depth: int):
            if depth > max_depth or node_id in visited:
                return

            visited.add(node_id)

            if node_id in self._decision_points:
                node_data = self.graph.nodes[node_id]
                decision_points.append({
                    "node_id": node_id,
                    "title": node_data.get("title"),
                    "depth": depth,
                    "data": node_data.get("data", {})
                })

            for succ_id in self.graph.successors(node_id):
                explore(succ_id, depth + 1)

        explore(current_node, 0)
        return decision_points

    def detect_loops(self) -> List[List[str]]:
        """Detect any loops in the story graph."""
        try:
            cycles = list(nx.simple_cycles(self.graph))
            return cycles
        except nx.NetworkXNoCycle:
            return []

    def detect_dead_ends(self) -> List[str]:
        """Find nodes with no outgoing edges (other than endings)."""
        dead_ends = []
        for node_id in self.graph.nodes:
            if node_id not in self._endings:
                if self.graph.out_degree(node_id) == 0:
                    dead_ends.append(node_id)
        return dead_ends

    def get_critical_path(self, start_node: str, end_node: str) -> Optional[List[str]]:
        """Get the shortest/most likely path between two nodes."""
        try:
            return nx.shortest_path(self.graph, start_node, end_node)
        except nx.NetworkXNoPath:
            return None

    def get_branch_analysis(self, node_id: str) -> Dict[str, Any]:
        """Analyze branches from a node."""
        successors = self.get_successors(node_id)

        return {
            "node_id": node_id,
            "branch_count": len(successors),
            "branches": successors,
            "has_conditional_branches": any(
                s.get("condition") for s in successors
            ),
            "endings_reachable": list(
                self.find_paths_to_endings(node_id).keys()
            )
        }

    def build_from_campaign_data(self, campaign_data: Dict[str, Any]) -> None:
        """Build graph from campaign database data."""
        # Add scene nodes
        for act in campaign_data.get("acts", []):
            for chapter in act.get("chapters", []):
                for scene in chapter.get("scenes", []):
                    node_id = f"scene_{scene['id']}"
                    self.add_node(StoryNode(
                        node_id=node_id,
                        node_type="scene",
                        title=scene.get("title", ""),
                        act=act.get("act_number", 1),
                        chapter=chapter.get("chapter_number", 1),
                        scene=scene.get("scene_order", 1),
                        data=scene
                    ))

                    # Add edge to next scene
                    if scene.get("next_scene_default"):
                        self.add_edge(StoryEdge(
                            from_node=node_id,
                            to_node=f"scene_{scene['next_scene_default']}",
                            probability=1.0
                        ))

                    # Add branch edges
                    for branch in scene.get("branch_triggers", []):
                        self.add_edge(StoryEdge(
                            from_node=node_id,
                            to_node=f"scene_{branch['target_scene']}",
                            condition=branch.get("condition"),
                            probability=branch.get("probability", 0.5),
                            label=branch.get("label")
                        ))

        # Add decision nodes
        for decision in campaign_data.get("decisions", []):
            node_id = f"decision_{decision['decision_code']}"
            self.add_node(StoryNode(
                node_id=node_id,
                node_type="decision",
                title=decision.get("title", ""),
                data=decision
            ))

        # Add ending nodes
        for ending in campaign_data.get("endings", []):
            node_id = f"ending_{ending['code']}"
            self.add_node(StoryNode(
                node_id=node_id,
                node_type="ending",
                title=ending.get("title", ""),
                data=ending
            ))

    def export_to_dict(self) -> Dict[str, Any]:
        """Export graph to dictionary format."""
        return {
            "nodes": [
                {"id": n, **self.graph.nodes[n]}
                for n in self.graph.nodes
            ],
            "edges": [
                {
                    "from": u,
                    "to": v,
                    **self.graph.edges[u, v]
                }
                for u, v in self.graph.edges
            ],
            "endings": list(self._endings),
            "decision_points": list(self._decision_points)
        }


# Cache for campaign graphs
_campaign_graphs: Dict[int, StoryGraph] = {}


def get_campaign_graph(campaign_id: int) -> Optional[StoryGraph]:
    """Get cached campaign graph."""
    return _campaign_graphs.get(campaign_id)


def set_campaign_graph(campaign_id: int, graph: StoryGraph) -> None:
    """Cache campaign graph."""
    _campaign_graphs[campaign_id] = graph


def clear_campaign_graph(campaign_id: int) -> None:
    """Clear cached campaign graph."""
    if campaign_id in _campaign_graphs:
        del _campaign_graphs[campaign_id]
