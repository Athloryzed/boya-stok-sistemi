import requests
import sys
import json
from datetime import datetime

class FlexoFactoryAPITester:
    def __init__(self, base_url="https://agent-summarizer-1.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def run_test(self, name, method, endpoint, expected_status, data=None, description=""):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        if description:
            print(f"   Description: {description}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=10)

            success = response.status_code == expected_status
            
            result = {
                "test_name": name,
                "method": method,
                "endpoint": endpoint,
                "expected_status": expected_status,
                "actual_status": response.status_code,
                "success": success,
                "response_data": None,
                "error": None
            }

            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    result["response_data"] = response.json()
                except:
                    result["response_data"] = response.text
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_data = response.json()
                    result["error"] = error_data
                    print(f"   Error: {error_data}")
                except:
                    result["error"] = response.text
                    print(f"   Error: {response.text}")

            self.test_results.append(result)
            return success, result["response_data"] if success else {}

        except Exception as e:
            print(f"❌ Failed - Exception: {str(e)}")
            result = {
                "test_name": name,
                "method": method,
                "endpoint": endpoint,
                "expected_status": expected_status,
                "actual_status": "Exception",
                "success": False,
                "response_data": None,
                "error": str(e)
            }
            self.test_results.append(result)
            return False, {}

    def test_root_endpoint(self):
        """Test root API endpoint"""
        return self.run_test(
            "Root API",
            "GET",
            "",
            200,
            description="Check if API is accessible"
        )

    def test_machine_initialization(self):
        """Test machine initialization"""
        return self.run_test(
            "Machine Initialization",
            "POST",
            "machines/init",
            200,
            description="Initialize 8 machines for the factory"
        )

    def test_get_machines(self):
        """Test getting all machines"""
        success, response = self.run_test(
            "Get Machines",
            "GET",
            "machines",
            200,
            description="Retrieve all factory machines"
        )
        
        if success and isinstance(response, list):
            print(f"   Found {len(response)} machines")
            machine_names = [m.get('name', 'Unknown') for m in response]
            print(f"   Machine names: {machine_names}")
            
        return success, response

    def test_machine_maintenance(self, machine_id, machine_name):
        """Test machine maintenance toggle"""
        # Put machine in maintenance
        success1, _ = self.run_test(
            f"Put {machine_name} in Maintenance",
            "PUT",
            f"machines/{machine_id}/maintenance",
            200,
            data={"maintenance": True, "reason": "Test maintenance"},
            description=f"Put machine {machine_name} into maintenance mode"
        )
        
        # Take machine out of maintenance
        success2, _ = self.run_test(
            f"Remove {machine_name} from Maintenance",
            "PUT",
            f"machines/{machine_id}/maintenance",
            200,
            data={"maintenance": False},
            description=f"Remove machine {machine_name} from maintenance mode"
        )
        
        return success1 and success2

    def test_job_creation(self, machine_id, machine_name):
        """Test job creation"""
        job_data = {
            "name": "Test Job - Kağıt Üretimi",
            "koli_count": 100,
            "colors": "Beyaz, Mavi",
            "machine_id": machine_id,
            "machine_name": machine_name,
            "notes": "Test job for API testing",
            "delivery_date": "2025-01-15"
        }
        
        success, response = self.run_test(
            "Create Job",
            "POST",
            "jobs",
            200,
            data=job_data,
            description=f"Create a test job for machine {machine_name}"
        )
        
        return success, response.get('id') if success else None

    def test_get_jobs(self):
        """Test getting all jobs"""
        return self.run_test(
            "Get All Jobs",
            "GET",
            "jobs",
            200,
            description="Retrieve all jobs in the system"
        )

    def test_job_workflow(self, job_id):
        """Test complete job workflow: start -> complete"""
        if not job_id:
            print("❌ No job ID provided for workflow test")
            return False
            
        # Start job
        success1, _ = self.run_test(
            "Start Job",
            "PUT",
            f"jobs/{job_id}/start",
            200,
            data={"operator_name": "Test Operator"},
            description="Start a job with an operator"
        )
        
        # Complete job
        success2, _ = self.run_test(
            "Complete Job",
            "PUT",
            f"jobs/{job_id}/complete",
            200,
            description="Complete the started job"
        )
        
        return success1 and success2

    def test_shift_management(self):
        """Test shift start and end"""
        # Start shift
        success1, _ = self.run_test(
            "Start Shift",
            "POST",
            "shifts/start",
            200,
            description="Start a new work shift"
        )
        
        # Get current shift
        success2, _ = self.run_test(
            "Get Current Shift",
            "GET",
            "shifts/current",
            200,
            description="Get the currently active shift"
        )
        
        # End shift
        success3, _ = self.run_test(
            "End Shift",
            "POST",
            "shifts/end",
            200,
            description="End the current work shift"
        )
        
        return success1 and success2 and success3

    def test_analytics(self):
        """Test analytics endpoints"""
        success1, _ = self.run_test(
            "Weekly Analytics",
            "GET",
            "analytics/weekly",
            200,
            description="Get weekly production analytics"
        )
        
        success2, _ = self.run_test(
            "Monthly Analytics",
            "GET",
            "analytics/monthly",
            200,
            description="Get monthly production analytics"
        )
        
        return success1 and success2

    def test_warehouse_requests(self):
        """Test warehouse request system"""
        request_data = {
            "operator_name": "Test Operator",
            "machine_name": "40x40",
            "item_type": "Kağıt Rulosu",
            "quantity": 5
        }
        
        # Create warehouse request
        success1, response = self.run_test(
            "Create Warehouse Request",
            "POST",
            "warehouse-requests",
            200,
            data=request_data,
            description="Create a material request from warehouse"
        )
        
        # Get warehouse requests
        success2, _ = self.run_test(
            "Get Warehouse Requests",
            "GET",
            "warehouse-requests",
            200,
            description="Retrieve all warehouse requests"
        )
        
        # Complete request if created successfully
        request_id = response.get('id') if success1 else None
        success3 = True
        if request_id:
            success3, _ = self.run_test(
                "Complete Warehouse Request",
                "PUT",
                f"warehouse-requests/{request_id}/complete",
                200,
                description="Complete a warehouse request"
            )
        
        return success1 and success2 and success3

    def test_pallet_scanning(self):
        """Test pallet scanning system"""
        pallet_data = {
            "pallet_code": "PLT-TEST-001",
            "job_id": "test-job-id",
            "job_name": "Test Job",
            "operator_name": "Test Operator"
        }
        
        # Scan pallet
        success1, _ = self.run_test(
            "Scan Pallet",
            "POST",
            "pallets",
            200,
            data=pallet_data,
            description="Scan a pallet code"
        )
        
        # Get pallets
        success2, _ = self.run_test(
            "Get Pallets",
            "GET",
            "pallets",
            200,
            description="Retrieve all scanned pallets"
        )
        
        return success1 and success2

    def test_maintenance_logs(self):
        """Test maintenance logs"""
        return self.run_test(
            "Get Maintenance Logs",
            "GET",
            "maintenance-logs",
            200,
            description="Retrieve maintenance history logs"
        )

def main():
    print("🏭 Starting Flexo Paper Factory API Tests...")
    print("=" * 60)
    
    tester = FlexoFactoryAPITester()
    
    # Test basic connectivity
    print("\n📡 BASIC CONNECTIVITY TESTS")
    print("-" * 40)
    tester.test_root_endpoint()
    
    # Test machine management
    print("\n🏭 MACHINE MANAGEMENT TESTS")
    print("-" * 40)
    tester.test_machine_initialization()
    success, machines = tester.test_get_machines()
    
    # Test machine maintenance if machines exist
    if success and machines and len(machines) > 0:
        first_machine = machines[0]
        machine_id = first_machine.get('id')
        machine_name = first_machine.get('name', 'Unknown')
        if machine_id:
            tester.test_machine_maintenance(machine_id, machine_name)
    
    # Test job management
    print("\n📋 JOB MANAGEMENT TESTS")
    print("-" * 40)
    job_id = None
    if success and machines and len(machines) > 0:
        first_machine = machines[0]
        machine_id = first_machine.get('id')
        machine_name = first_machine.get('name', 'Unknown')
        if machine_id:
            job_success, job_id = tester.test_job_creation(machine_id, machine_name)
    
    tester.test_get_jobs()
    
    # Test job workflow
    if job_id:
        tester.test_job_workflow(job_id)
    
    # Test shift management
    print("\n⏰ SHIFT MANAGEMENT TESTS")
    print("-" * 40)
    tester.test_shift_management()
    
    # Test analytics
    print("\n📊 ANALYTICS TESTS")
    print("-" * 40)
    tester.test_analytics()
    
    # Test warehouse system
    print("\n📦 WAREHOUSE SYSTEM TESTS")
    print("-" * 40)
    tester.test_warehouse_requests()
    tester.test_pallet_scanning()
    
    # Test maintenance logs
    print("\n🔧 MAINTENANCE SYSTEM TESTS")
    print("-" * 40)
    tester.test_maintenance_logs()
    
    # Print final results
    print("\n" + "=" * 60)
    print("📊 FINAL TEST RESULTS")
    print("=" * 60)
    print(f"Total Tests: {tester.tests_run}")
    print(f"Passed: {tester.tests_passed}")
    print(f"Failed: {tester.tests_run - tester.tests_passed}")
    print(f"Success Rate: {(tester.tests_passed / tester.tests_run * 100):.1f}%")
    
    # Save detailed results
    results_file = "/app/backend_test_results.json"
    with open(results_file, 'w', encoding='utf-8') as f:
        json.dump({
            "timestamp": datetime.now().isoformat(),
            "summary": {
                "total_tests": tester.tests_run,
                "passed_tests": tester.tests_passed,
                "failed_tests": tester.tests_run - tester.tests_passed,
                "success_rate": tester.tests_passed / tester.tests_run * 100
            },
            "detailed_results": tester.test_results
        }, f, indent=2, ensure_ascii=False)
    
    print(f"\n📄 Detailed results saved to: {results_file}")
    
    return 0 if tester.tests_passed == tester.tests_run else 1

if __name__ == "__main__":
    sys.exit(main())